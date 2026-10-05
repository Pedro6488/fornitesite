import { NextResponse } from "next/server";
import { z } from "zod";
import { canPurchase } from "@/features/catalog/domain/catalog-item";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { validationStatus } from "@/features/eligibility/application/validation-status";
import { selectBestAgentForCart } from "@/features/eligibility/domain/delivery-agent";
import { getAgentProvider } from "@/features/eligibility/server/get-agent-provider";
import { attachCommerceCookie, requireCommerceSession } from "@/shared/server/commerce-session";
import { consumeCommerceRateLimit } from "@/shared/server/commerce-rate-limit";

const schema = z.object({
  quoteId: z.uuid(),
  validationId: z.uuid(),
  whatsapp: z.string().trim().min(8).max(24).regex(/^[0-9+ ()-]+$/),
  customerEmail: z.union([z.email(), z.literal("")]).optional().default(""),
  idempotencyKey: z.uuid()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa los datos de contacto y vuelve a intentarlo." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  try {
    const { data: existingOrder } = await context.database.from("orders")
      .select("id,public_token").eq("idempotency_key", parsed.data.idempotencyKey)
      .eq("commerce_session_id", context.session.id).maybeSingle();
    if (existingOrder) {
      return attachCommerceCookie(NextResponse.json({ order: { id: existingOrder.id, publicToken: existingOrder.public_token }, duplicate: true }), context.session);
    }
    if (!await consumeCommerceRateLimit(context.database, context.session.id, "checkout.create-order", 15, 600)) {
      return attachCommerceCookie(NextResponse.json({ error: "Demasiados intentos de confirmación. Espera unos minutos." }, { status: 429 }), context.session);
    }
    const { data: quote } = await context.database.from("checkout_quotes")
      .select("id,validation_id,total_vbucks,expires_at,consumed_at,checkout_quote_items(item_main_id,offer_id)")
      .eq("id", parsed.data.quoteId).eq("commerce_session_id", context.session.id).maybeSingle();
    if (!quote || quote.validation_id !== parsed.data.validationId || quote.consumed_at || new Date(quote.expires_at).getTime() <= Date.now()) {
      return attachCommerceCookie(NextResponse.json({ error: "La cotización venció. Actualiza la revisión antes de confirmar." }, { status: 409 }), context.session);
    }
    const { data: validation } = await context.database.from("game_id_validations")
      .select("id,epic_account_id").eq("id", parsed.data.validationId)
      .eq("commerce_session_id", context.session.id).maybeSingle();
    if (!validation) return attachCommerceCookie(NextResponse.json({ error: "El ID validado ya no está disponible." }, { status: 409 }), context.session);

    const quoteLines = Array.isArray(quote.checkout_quote_items) ? quote.checkout_quote_items : [];
    const catalog = await (await getCatalogService()).list();
    const currentItems = new Map(catalog.map((item) => [item.mainId, item]));
    const offersRemainAvailable = quoteLines.length > 0 && quoteLines.every((line) => {
      const current = currentItems.get(line.item_main_id);
      return current && canPurchase(current) && current.offerId === line.offer_id;
    });
    if (!offersRemainAvailable) {
      return attachCommerceCookie(NextResponse.json({ error: "Uno de los objetos dejó de estar disponible. Genera una nueva cotización." }, { status: 409 }), context.session);
    }

    const agents = await getAgentProvider().listForReceiver(validation.epic_account_id);
    const state = validationStatus(agents);
    const selectedAgent = selectBestAgentForCart(agents, quote.total_vbucks, quoteLines.length);
    await context.database.from("game_id_validations").update({
      status: state.status,
      giftable_at: state.giftableAt,
      agents_snapshot: agents,
      last_checked_at: new Date().toISOString()
    }).eq("id", validation.id);
    if (!selectedAgent) {
      return attachCommerceCookie(NextResponse.json({ error: "El ID, saldo o capacidad cambiaron. Vuelve a revisar el pedido." }, { status: 409 }), context.session);
    }
    await context.database.from("checkout_quotes").update({ selected_agent_id: selectedAgent.id }).eq("id", quote.id);

    const { data, error } = await context.database.rpc("create_order_from_quote", {
      p_quote_id: parsed.data.quoteId,
      p_validation_id: parsed.data.validationId,
      p_whatsapp: parsed.data.whatsapp,
      p_email: parsed.data.customerEmail,
      p_idempotency_key: parsed.data.idempotencyKey
    });
    if (error) {
      const conflict = /quote_expired|validation_mismatch|recipient_not_ready|empty_quote|idempotency_mismatch/.test(error.message);
      return attachCommerceCookie(NextResponse.json({
        error: conflict ? "La cotización o el ID ya no son válidos. Actualiza la revisión antes de confirmar." : "No fue posible guardar el pedido."
      }, { status: conflict ? 409 : 503 }), context.session);
    }
    const order = Array.isArray(data) ? data[0] : data;
    if (!order) throw new Error("La transacción no devolvió la orden.");
    if (context.session.user) await context.database.from("orders").update({ user_id: context.session.user.id }).eq("id", order.order_id);
    return attachCommerceCookie(NextResponse.json({ order: { id: order.order_id, publicToken: order.public_token } }, { status: 201 }), context.session);
  } catch (error) {
    console.error("cart-order.create.failed", error);
    return attachCommerceCookie(NextResponse.json({ error: "No fue posible confirmar el pedido." }, { status: 503 }), context.session);
  }
}
