import { NextResponse } from "next/server";
import { z } from "zod";
import { canPurchase } from "@/features/catalog/domain/catalog-item";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { validationStatus } from "@/features/eligibility/application/validation-status";
import { getAgentProvider } from "@/features/eligibility/server/get-agent-provider";
import { selectBestAgentForCart } from "@/features/eligibility/domain/delivery-agent";
import { attachCommerceCookie, requireCommerceSession } from "@/shared/server/commerce-session";
import { consumeCommerceRateLimit } from "@/shared/server/commerce-rate-limit";

const schema = z.object({
  validationId: z.uuid(),
  itemIds: z.array(z.string().min(1).max(180)).min(1).max(30)
}).refine((value) => new Set(value.itemIds).size === value.itemIds.length, "No se permiten artículos duplicados.");

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "La solicitud de cotización no es válida." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  const { database, session } = context;
  try {
    if (!await consumeCommerceRateLimit(database, session.id, "checkout.quote", 20, 600)) {
      return attachCommerceCookie(NextResponse.json({ error: "Has solicitado demasiadas cotizaciones. Espera unos minutos." }, { status: 429 }), session);
    }
  } catch (error) {
    console.error("checkout.quote.rate-limit.failed", error);
    return attachCommerceCookie(NextResponse.json({ error: "No fue posible validar la solicitud." }, { status: 503 }), session);
  }
  const { data: validation } = await database.from("game_id_validations")
    .select("id,epic_account_id,display_name,platform,status")
    .eq("id", parsed.data.validationId).eq("commerce_session_id", session.id).maybeSingle();
  if (!validation) return attachCommerceCookie(NextResponse.json({ error: "Valida el ID que recibirá los objetos." }, { status: 409 }), session);
  if (validation.status !== "ready") {
    const message = validation.status === "waiting"
      ? "La solicitud de amistad ya fue enviada; espera a que se cumplan las 48 horas."
      : validation.status === "manual_review"
        ? "Tu ID está esperando la revisión del equipo antes de solicitar amistad."
        : "Este ID todavía no está listo para recibir objetos.";
    return attachCommerceCookie(NextResponse.json({ error: message, code: "recipient_not_ready", validationStatus: validation.status }, { status: 409 }), session);
  }

  try {
    const catalogItems = await (await getCatalogService()).list();
    const byId = new Map(catalogItems.map((item) => [item.mainId, item]));
    const items = parsed.data.itemIds.map((id) => byId.get(id));
    if (items.some((item) => !item || !canPurchase(item) || item.priceMxn === null || !item.offerId)) {
      return attachCommerceCookie(NextResponse.json({ error: "Uno de los objetos cambió de precio o dejó de estar disponible.", code: "catalog_changed" }, { status: 409 }), session);
    }
    const resolved = items.map((item) => item!);
    const totalVbucks = resolved.reduce((sum, item) => sum + item.finalPriceVbucks, 0);
    let selectedAgentId: string | null = null;
    if (process.env.FULFILLMENT_MODE === "fnshop") {
      const agents = await getAgentProvider().listForReceiver(validation.epic_account_id);
      const state = validationStatus(agents);
      await database.from("game_id_validations").update({
        status: state.status,
        giftable_at: state.giftableAt,
        agents_snapshot: agents,
        last_checked_at: new Date().toISOString()
      }).eq("id", validation.id);
      const selectedAgent = selectBestAgentForCart(agents, totalVbucks, resolved.length);
      if (!selectedAgent) {
        const message = state.status === "waiting"
          ? "El ID es válido, pero todavía debe cumplirse la espera de 48 horas."
          : state.status === "pending_friendship"
            ? "El ID es válido, pero aún debes aceptar la solicitud de amistad en Fortnite."
            : "No existe un agente con amistad, saldo y cupo suficientes para este carrito.";
        return attachCommerceCookie(NextResponse.json({ error: message, code: "recipient_not_ready", validationStatus: state.status }), session);
      }
      selectedAgentId = selectedAgent.id;
    }

    const amountMxnCents = resolved.reduce((sum, item) => sum + Math.round(item.priceMxn! * 100), 0);
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const { data: quote, error: quoteError } = await database.from("checkout_quotes").insert({
      commerce_session_id: session.id,
      validation_id: validation.id,
      amount_mxn_cents: amountMxnCents,
      total_vbucks: totalVbucks,
      selected_agent_id: selectedAgentId,
      expires_at: expiresAt
    }).select("id,expires_at").single();
    if (quoteError || !quote) throw quoteError ?? new Error("No se guardó la cotización.");
    const lines = resolved.map((item) => ({
      quote_id: quote.id,
      item_main_id: item.mainId,
      offer_id: item.offerId!,
      item_name: item.name,
      item_image_url: item.imageUrl,
      vbucks_price: item.finalPriceVbucks,
      unit_amount_mxn_cents: Math.round(item.priceMxn! * 100),
      quantity: 1
    }));
    const { error: lineError } = await database.from("checkout_quote_items").insert(lines);
    if (lineError) {
      await database.from("checkout_quotes").delete().eq("id", quote.id);
      throw lineError;
    }
    return attachCommerceCookie(NextResponse.json({
      quote: {
        id: quote.id,
        expiresAt: quote.expires_at,
        amountMxnCents,
        totalVbucks,
        lines: lines.map((line) => ({
          itemMainId: line.item_main_id,
          name: line.item_name,
          imageUrl: line.item_image_url,
          vbucksPrice: line.vbucks_price,
          amountMxnCents: line.unit_amount_mxn_cents
        }))
      }
    }), session);
  } catch (error) {
    console.error("checkout.quote.failed", error);
    return attachCommerceCookie(NextResponse.json({ error: "No fue posible cotizar y validar el carrito." }, { status: 503 }), session);
  }
}
