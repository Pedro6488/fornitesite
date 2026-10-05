import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentProvider } from "@/features/eligibility/server/get-agent-provider";
import type { DeliveryAgent } from "@/features/eligibility/domain/delivery-agent";
import { attachCommerceCookie, requireCommerceSession } from "@/shared/server/commerce-session";
import { consumeCommerceRateLimit } from "@/shared/server/commerce-rate-limit";

const schema = z.object({ validationId: z.uuid() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validación inválida." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  const { data: validation } = await context.database.from("game_id_validations")
    .select("id,epic_account_id,status,agents_snapshot").eq("id", parsed.data.validationId)
    .eq("commerce_session_id", context.session.id).maybeSingle();
  if (!validation) return attachCommerceCookie(NextResponse.json({ error: "El ID no pertenece a esta sesión." }, { status: 404 }), context.session);
  if (validation.status === "ready") return attachCommerceCookie(NextResponse.json({ ok: true, alreadyReady: true }), context.session);
  if (validation.status === "manual_review") {
    return attachCommerceCookie(NextResponse.json({ ok: true, manualReview: true }), context.session);
  }
  try {
    const { data: priorRequest } = await context.database.from("friend_request_records")
      .select("requested_at").eq("epic_account_id", validation.epic_account_id).maybeSingle();
    if (priorRequest) return attachCommerceCookie(NextResponse.json({ ok: true, alreadyRequested: true, requestedAt: priorRequest.requested_at }), context.session);
    const agents = Array.isArray(validation.agents_snapshot) ? validation.agents_snapshot as DeliveryAgent[] : [];
    if (agents.some((agent) => ["pending", "waiting", "ready"].includes(agent.friendship))) {
      return attachCommerceCookie(NextResponse.json({ ok: true, alreadyRequested: true }), context.session);
    }
    if (!await consumeCommerceRateLimit(context.database, context.session.id, "identity.friend-request", 3, 3600)) {
      return attachCommerceCookie(NextResponse.json({ error: "Ya se realizaron varias solicitudes. Espera antes de volver a intentar." }, { status: 429 }), context.session);
    }
    const result = await getAgentProvider().addFriend(validation.epic_account_id);
    const { error: recordError } = await context.database.from("friend_request_records").insert({
      epic_account_id: validation.epic_account_id,
      validation_id: validation.id,
      provider_response: result
    });
    if (recordError && recordError.code !== "23505") throw recordError;
    const pendingSnapshot = agents.map((agent) => agent.friendship === "not_added" ? { ...agent, friendship: "pending" } : agent);
    await context.database.from("game_id_validations").update({
      status: "pending_friendship",
      agents_snapshot: pendingSnapshot,
      last_checked_at: new Date().toISOString()
    }).eq("id", validation.id);
    return attachCommerceCookie(NextResponse.json({ ok: true, ...result }), context.session);
  } catch (error) {
    console.error("identity.friend-request.failed", error);
    return attachCommerceCookie(NextResponse.json({ error: "No fue posible enviar la solicitud de amistad." }, { status: 503 }), context.session);
  }
}
