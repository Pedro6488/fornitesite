import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { validationStatus } from "@/features/eligibility/application/validation-status";
import { getAgentProvider } from "@/features/eligibility/server/get-agent-provider";
import { attachCommerceCookie, requireCommerceSession } from "@/shared/server/commerce-session";
import { consumeCommerceRateLimit } from "@/shared/server/commerce-rate-limit";

const schema = z.object({
  displayName: z.string().trim().min(3).max(32),
  platform: z.enum(["epic", "xbl", "psn", "nintendo"])
});

function manualRecipientId(platform: string, displayName: string) {
  const normalized = `${platform}:${displayName.trim().toLocaleLowerCase("es-MX")}`;
  return `manual:${createHash("sha256").update(normalized).digest("hex")}`;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escribe un ID y una plataforma válidos." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });

  try {
    if (!await consumeCommerceRateLimit(context.database, context.session.id, "identity.validate", 10, 600)) {
      return attachCommerceCookie(NextResponse.json({ error: "Demasiados intentos. Espera unos minutos antes de validar otro ID." }, { status: 429 }), context.session);
    }
    // Mientras el proveedor de entrega no esté integrado, el ID se conserva para
    // revisión humana. No fingimos una validación automática ni bloqueamos al cliente.
    if (process.env.FULFILLMENT_MODE !== "fnshop") {
      const epicAccountId = manualRecipientId(parsed.data.platform, parsed.data.displayName);
      const { data: priorRequest } = await context.database.from("friend_request_records")
        .select("requested_at").eq("epic_account_id", epicAccountId).maybeSingle();
      const requestedAt = priorRequest?.requested_at ?? new Date().toISOString();
      const giftableAt = new Date(new Date(requestedAt).getTime() + 48 * 60 * 60_000).toISOString();
      const { data: existing } = await context.database.from("game_id_validations")
        .select("id,status,giftable_at").eq("commerce_session_id", context.session.id).eq("epic_account_id", epicAccountId).maybeSingle();
      const keepsApproval = existing?.status === "ready";
      const payload = {
        commerce_session_id: context.session.id,
        user_id: context.session.user?.id ?? null,
        platform: parsed.data.platform,
        submitted_id: parsed.data.displayName,
        epic_account_id: epicAccountId,
        display_name: parsed.data.displayName,
        status: keepsApproval ? "ready" : "manual_review",
        giftable_at: keepsApproval ? existing?.giftable_at ?? null : giftableAt,
        provider: "manual",
        agents_snapshot: [],
        last_checked_at: new Date().toISOString()
      };
      const operation = existing
        ? context.database.from("game_id_validations").update(payload).eq("id", existing.id)
        : context.database.from("game_id_validations").insert(payload);
      const { data, error } = await operation.select("id,platform,submitted_id,epic_account_id,display_name,status,giftable_at,last_checked_at").single();
      if (error || !data) throw error ?? new Error("No se guardó el ID para revisión.");
      if (!priorRequest) {
        const { error: requestError } = await context.database.from("friend_request_records").insert({
          epic_account_id: epicAccountId,
          validation_id: data.id,
          requested_at: requestedAt,
          provider_response: { mode: "manual", status: "queued" }
        });
        if (requestError && requestError.code !== "23505") throw requestError;
      }
      const { error: activeError } = await context.database.from("commerce_sessions")
        .update({ active_game_id_validation_id: data.id, last_seen_at: new Date().toISOString() }).eq("id", context.session.id);
      if (activeError) throw activeError;
      return attachCommerceCookie(NextResponse.json({ validation: data, agents: [], manualReview: true }), context.session);
    }
    const provider = getAgentProvider();
    const receiver = await provider.resolveAccount(parsed.data.displayName, parsed.data.platform);
    let agents = await provider.listForReceiver(receiver.epicAccountId);
    const { data: priorRequest } = await context.database.from("friend_request_records")
      .select("epic_account_id").eq("epic_account_id", receiver.epicAccountId).maybeSingle();
    if (priorRequest && agents.every((agent) => agent.friendship === "not_added" || agent.friendship === "blocked")) {
      agents = agents.map((agent) => agent.friendship === "not_added" ? { ...agent, friendship: "pending" as const } : agent);
    }
    const state = validationStatus(agents);
    const payload = {
      commerce_session_id: context.session.id,
      user_id: context.session.user?.id ?? null,
      platform: parsed.data.platform,
      submitted_id: parsed.data.displayName,
      epic_account_id: receiver.epicAccountId,
      display_name: receiver.displayName,
      status: state.status,
      giftable_at: state.giftableAt,
      agents_snapshot: agents,
      last_checked_at: new Date().toISOString()
    };
    const { data: existing } = await context.database.from("game_id_validations")
      .select("id").eq("commerce_session_id", context.session.id).eq("epic_account_id", receiver.epicAccountId).maybeSingle();
    const operation = existing
      ? context.database.from("game_id_validations").update(payload).eq("id", existing.id)
      : context.database.from("game_id_validations").insert(payload);
    const { data, error } = await operation.select("id,platform,submitted_id,epic_account_id,display_name,status,giftable_at,last_checked_at").single();
    if (error || !data) throw error ?? new Error("No se guardó la validación.");
    const { error: activeError } = await context.database.from("commerce_sessions")
      .update({ active_game_id_validation_id: data.id, last_seen_at: new Date().toISOString() }).eq("id", context.session.id);
    if (activeError) throw activeError;
    return attachCommerceCookie(NextResponse.json({ validation: data, agents }), context.session);
  } catch (error) {
    console.error("identity.validation.failed", error);
    return attachCommerceCookie(NextResponse.json({
      error: "No pudimos validar el ID en este momento. Por seguridad no es posible continuar con la compra."
    }, { status: 503 }), context.session);
  }
}
