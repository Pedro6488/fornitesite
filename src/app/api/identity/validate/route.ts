import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { attachCommerceCookie, requireCommerceSession } from "@/shared/server/commerce-session";
import { consumeCommerceRateLimit } from "@/shared/server/commerce-rate-limit";
import { CUSTOMER_VALIDATION_FIELDS as VALIDATION_FIELDS, inheritManualValidation, type IdentityValidationStatus } from "@/features/commerce/application/identity-review-state";
import { fnShopReceiver, interpretFriendAdd } from "@/features/commerce/application/fnshop-identity";
import { automaticDeliveryEnabled, getFnShopClient } from "@/features/fnshop/server/get-fnshop-client";

const schema = z.object({
  displayName: z.string().trim().min(3).max(32),
  platform: z.enum(["epic", "xbl", "psn", "nintendo"])
});

/** Llave del destinatario: plataforma + gamertag. Comparte el estado entre sesiones y dispositivos. */
function recipientKey(platform: string, displayName: string) {
  const normalized = `${platform}:${displayName.trim().toLocaleLowerCase("es-MX")}`;
  return `manual:${createHash("sha256").update(normalized).digest("hex")}`;
}

type KnownValidation = {
  id: string; commerce_session_id: string; status: IdentityValidationStatus; giftable_at: string | null;
  provider_receiver_id: string | null; friend_requested_at: string | null;
};

/**
 * Guarda el ID que recibirá los objetos.
 *
 * - Un ID ya conocido hereda su estado (listo, en espera o bloqueado): 0 requests.
 * - Con entrega automática, un ID nuevo se valida con una sola llamada `friend_add`,
 *   que además envía la solicitud de amistad desde las cuentas remitentes.
 * - Si FN Shop no está disponible, la cuota está en reserva o la respuesta no es clara,
 *   el ID queda en revisión manual como hasta ahora.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escribe un ID y una plataforma válidos." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  const { database, session } = context;
  const { platform, displayName } = parsed.data;

  try {
    if (!await consumeCommerceRateLimit(database, session.id, "identity.validate", 10, 600)) {
      return attachCommerceCookie(NextResponse.json({ error: "Demasiados intentos. Espera unos minutos antes de validar otro ID." }, { status: 429 }), session);
    }
    const epicAccountId = recipientKey(platform, displayName);
    const { data: knownValidations, error: knownError } = await database.from("game_id_validations")
      .select("id,commerce_session_id,status,giftable_at,provider_receiver_id,friend_requested_at")
      .eq("epic_account_id", epicAccountId).limit(100)
      .returns<KnownValidation[]>();
    if (knownError) throw knownError;
    const known = knownValidations ?? [];
    const existing = known.find((validation) => validation.commerce_session_id === session.id);
    const validationId = existing?.id ?? randomUUID();
    const inherited = inheritManualValidation(known);
    const previousRequest = known.find((validation) => validation.friend_requested_at);

    let status: IdentityValidationStatus = inherited.status;
    let giftableAt = inherited.giftable_at;
    let provider = "manual";
    let providerReceiverId = known.find((validation) => validation.provider_receiver_id)?.provider_receiver_id ?? null;
    let friendRequestedAt = previousRequest?.friend_requested_at ?? null;
    let friendRequestRecord: Record<string, unknown> | null = null;

    if (status === "manual_review" && automaticDeliveryEnabled()) {
      if (previousRequest) {
        // La solicitud ya salió desde otra sesión: el cliente solo tiene que aceptarla.
        status = "pending_friendship";
        provider = "fnshop";
      } else {
        const client = getFnShopClient(database);
        if (client) {
          try {
            const response = await client.call("friend_add", {
              receiver: fnShopReceiver(platform, displayName),
              ...(client.config.category ? { category: client.config.category } : {}),
            }, { trigger: "customer", validationId, correlationId: session.id });
            const outcome = interpretFriendAdd(response.body);
            await client.decide(response.callId, outcome.kind);
            if (outcome.kind === "customer_fix") {
              return attachCommerceCookie(NextResponse.json({ error: outcome.message, code: outcome.code }, { status: 409 }), session);
            }
            if (outcome.kind !== "manual") {
              provider = "fnshop";
              providerReceiverId = outcome.receiverId ?? providerReceiverId;
              friendRequestedAt = new Date().toISOString();
              status = outcome.kind === "pending" ? "pending_friendship" : outcome.kind;
              giftableAt = outcome.kind === "waiting" ? outcome.giftableAt : null;
              friendRequestRecord = {
                epic_account_id: epicAccountId, validation_id: validationId, requested_at: friendRequestedAt,
                provider_response: { mode: "fnshop", code: response.code, call_id: response.callId },
              };
            }
          } catch (error) {
            // FN Shop caído, sin respuesta o cuota en reserva: el equipo lo revisa a mano.
            console.error("identity.fnshop.friend_add.failed", error);
          }
        }
      }
    }

    const payload = {
      commerce_session_id: session.id,
      user_id: session.user?.id ?? null,
      platform,
      submitted_id: displayName,
      epic_account_id: epicAccountId,
      display_name: displayName,
      status,
      giftable_at: giftableAt,
      provider,
      provider_receiver_id: providerReceiverId,
      friend_requested_at: friendRequestedAt,
      agents_snapshot: [],
      last_checked_at: new Date().toISOString()
    };
    const operation = existing
      ? database.from("game_id_validations").update(payload).eq("id", existing.id)
      : database.from("game_id_validations").insert({ id: validationId, ...payload });
    const { data, error } = await operation.select(VALIDATION_FIELDS).single();
    if (error || !data) throw error ?? new Error("No se guardó el ID.");
    if (friendRequestRecord) {
      // Después de guardar el ID: el registro apunta a él. Mantiene a la vista de revisión manual al tanto.
      const { error: recordError } = await database.from("friend_request_records").upsert(friendRequestRecord, { onConflict: "epic_account_id" });
      if (recordError) console.error("identity.friend-request.record.failed", recordError);
    }
    const { error: activeError } = await database.from("commerce_sessions")
      .update({ active_game_id_validation_id: data.id, last_seen_at: new Date().toISOString() }).eq("id", session.id);
    if (activeError) throw activeError;
    return attachCommerceCookie(NextResponse.json({ validation: data, manualReview: status === "manual_review" }), session);
  } catch (error) {
    console.error("identity.validation.failed", error);
    return attachCommerceCookie(NextResponse.json({
      error: "No pudimos guardar el ID en este momento. Intenta de nuevo en unos minutos."
    }, { status: 503 }), session);
  }
}
