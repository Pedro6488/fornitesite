import { NextResponse } from "next/server";
import { z } from "zod";
import { validationStatus } from "@/features/eligibility/application/validation-status";
import { getAgentProvider } from "@/features/eligibility/server/get-agent-provider";
import { attachCommerceCookie, requireCommerceSession } from "@/shared/server/commerce-session";
import { consumeCommerceRateLimit } from "@/shared/server/commerce-rate-limit";

const schema = z.object({
  displayName: z.string().trim().min(3).max(32),
  platform: z.enum(["epic", "xbl", "psn", "nintendo"])
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escribe un ID y una plataforma válidos." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });

  try {
    if (!await consumeCommerceRateLimit(context.database, context.session.id, "identity.validate", 10, 600)) {
      return attachCommerceCookie(NextResponse.json({ error: "Demasiados intentos. Espera unos minutos antes de validar otro ID." }, { status: 429 }), context.session);
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
    const { data, error } = await context.database.from("game_id_validations").insert({
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
    }).select("id,platform,submitted_id,epic_account_id,display_name,status,giftable_at,last_checked_at").single();
    if (error || !data) throw error ?? new Error("No se guardó la validación.");
    return attachCommerceCookie(NextResponse.json({ validation: data, agents }), context.session);
  } catch (error) {
    console.error("identity.validation.failed", error);
    return attachCommerceCookie(NextResponse.json({
      error: "No pudimos validar el ID en este momento. Por seguridad no es posible continuar con la compra."
    }, { status: 503 }), context.session);
  }
}
