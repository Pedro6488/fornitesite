import { NextResponse } from "next/server";
import { z } from "zod";
import { attachCommerceCookie, requireCommerceSession } from "@/shared/server/commerce-session";
import { CUSTOMER_VALIDATION_FIELDS } from "@/features/commerce/application/identity-review-state";
import { fnShopReceiver, friendshipCheckGate, interpretFriendStatus } from "@/features/commerce/application/fnshop-identity";
import { getFnShopClient } from "@/features/fnshop/server/get-fnshop-client";

const schema = z.object({ validationId: z.uuid() });

type Validation = {
  id: string; platform: string; display_name: string; status: string; provider_receiver_id: string | null;
  friendship_checks: number; friendship_checked_at: string | null;
};

/**
 * El cliente pulsa «Ya acepté la solicitud». Un `friend_status` confirma que la
 * amistad existe y da la hora exacta en que terminan las 48 h. Desde ahí la
 * espera se cuenta en nuestra base. Máximo 3 intentos por ID, cada 30 minutos.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validación inválida." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  const { database, session } = context;
  const respond = (body: Record<string, unknown>, status = 200) => attachCommerceCookie(NextResponse.json(body, { status }), session);

  const { data: validation } = await database.from("game_id_validations")
    .select("id,platform,display_name,status,provider_receiver_id,friendship_checks,friendship_checked_at")
    .eq("id", parsed.data.validationId).eq("commerce_session_id", session.id).maybeSingle<Validation>();
  if (!validation) return respond({ error: "El ID no pertenece a esta sesión." }, 404);

  const current = async () => (await database.from("game_id_validations").select(CUSTOMER_VALIDATION_FIELDS).eq("id", validation.id).single()).data;
  if (validation.status !== "pending_friendship") return respond({ validation: await current() });

  const gate = friendshipCheckGate(validation.friendship_checks, validation.friendship_checked_at);
  if (!gate.allowed) return respond({ error: gate.message, code: "friendship_check_limited" }, 429);

  const client = getFnShopClient(database);
  if (!client) return respond({ error: "Por ahora no podemos confirmar la amistad automáticamente. El equipo la revisará." }, 503);

  // Se cuenta el intento antes de llamar; la condición evita que dos clics gasten dos requests.
  const { data: claimed } = await database.from("game_id_validations")
    .update({ friendship_checks: validation.friendship_checks + 1, friendship_checked_at: new Date().toISOString() })
    .eq("id", validation.id).eq("friendship_checks", validation.friendship_checks).select("id").maybeSingle();
  if (!claimed) return respond({ error: "Ya estamos revisando tu solicitud. Espera un momento." }, 409);

  try {
    const response = await client.call("friend_status", {
      receiver: fnShopReceiver(validation.platform, validation.display_name),
      ...(validation.provider_receiver_id ? { receiver_id: validation.provider_receiver_id } : {}),
    }, { trigger: "customer", validationId: validation.id, correlationId: session.id });
    const outcome = interpretFriendStatus(response.body);
    await client.decide(response.callId, outcome.kind);

    if (outcome.kind === "pending") {
      return respond({ error: "Todavía no vemos la solicitud aceptada. En Fortnite abre Amigos → Solicitudes, acepta las de nuestras cuentas y vuelve a intentarlo.", code: "friendship_pending" }, 409);
    }
    const next = outcome.kind === "ready"
      ? { status: "ready", giftable_at: null, review_note: "Amistad confirmada con FN Shop." }
      : outcome.kind === "waiting"
        ? { status: "waiting", giftable_at: outcome.giftableAt }
        : { status: "manual_review", giftable_at: null, review_note: "FN Shop no encontró la solicitud de amistad; revisar con el cliente." };
    const { error } = await database.from("game_id_validations")
      .update({ ...next, last_checked_at: new Date().toISOString() }).eq("id", validation.id).eq("status", "pending_friendship");
    if (error) throw error;
    await database.from("audit_log").insert({
      action: outcome.kind === "none" ? "delivery_identity.friendship_not_found" : "delivery_identity.friendship_confirmed",
      entity_type: "game_id_validation", entity_id: validation.id,
      before_data: { status: "pending_friendship" }, after_data: { ...next, source: "fnshop", call_id: response.callId },
    });
    return respond({ validation: await current() });
  } catch (error) {
    console.error("identity.confirm-friendship.failed", error);
    return respond({ error: "No pudimos revisar la solicitud en este momento. Intenta de nuevo en unos minutos." }, 503);
  }
}
