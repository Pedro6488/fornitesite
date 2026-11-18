import { NextResponse } from "next/server";
import { z } from "zod";
import { canPurchase } from "@/features/catalog/domain/catalog-item";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { attachCommerceCookie, requireCommerceSession } from "@/shared/server/commerce-session";
import { consumeCommerceRateLimit } from "@/shared/server/commerce-rate-limit";
import { queueOutboxJob } from "@/features/notifications/server/outbox";
import { deliverOutboxJob } from "@/features/notifications/server/providers";
import { getFnShopClient } from "@/features/fnshop/server/get-fnshop-client";
import { runWalletJob } from "@/features/wallet/server/wallet-jobs";

export const maxDuration = 60;

const schema = z.object({
  quoteId: z.uuid(),
  validationId: z.uuid(),
  whatsapp: z.string().trim().regex(/^[0-9]{8,12}$/),
  customerEmail: z.union([z.email(), z.literal("")]).optional().default(""),
  idempotencyKey: z.uuid(),
  paymentSource: z.enum(["external","wallet"]).default("external")
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa los datos de contacto y vuelve a intentarlo." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  try {
    const useWallet = parsed.data.paymentSource === "wallet";
    if (useWallet && !context.session.user) return NextResponse.json({ error: "Inicia sesión para usar tus pavos." }, { status: 401 });
    const { data: existingOrder } = await context.database.from("orders")
      .select("id,public_token,payment_source,checkout_quote_id").eq("idempotency_key", parsed.data.idempotencyKey)
      .eq("commerce_session_id", context.session.id).maybeSingle();
    if (existingOrder) {
      if ((existingOrder.payment_source ?? "external") !== parsed.data.paymentSource || existingOrder.checkout_quote_id !== parsed.data.quoteId) return NextResponse.json({ error: "Este intento ya pertenece a otra compra o método de pago." }, { status: 409 });
      return attachCommerceCookie(NextResponse.json({ order: { id: existingOrder.id, publicToken: existingOrder.public_token }, duplicate: true }), context.session);
    }
    if (useWallet && !getFnShopClient(context.database)) return NextResponse.json({ error: "La entrega automática no está disponible. No se descontaron pavos; puedes usar el pago habitual." }, { status: 503 });
    if (!await consumeCommerceRateLimit(context.database, context.session.id, "checkout.create-order", 15, 600)) {
      return attachCommerceCookie(NextResponse.json({ error: "Demasiados intentos de confirmación. Espera unos minutos." }, { status: 429 }), context.session);
    }
    const { data: quote } = await context.database.from("checkout_quotes")
      .select("id,validation_id,total_vbucks,expires_at,consumed_at,checkout_quote_items(item_main_id,offer_id,vbucks_price)")
      .eq("id", parsed.data.quoteId).eq("commerce_session_id", context.session.id).maybeSingle();
    if (!quote || quote.validation_id !== parsed.data.validationId || quote.consumed_at || new Date(quote.expires_at).getTime() <= Date.now()) {
      return attachCommerceCookie(NextResponse.json({ error: "La cotización venció. Actualiza la revisión antes de confirmar." }, { status: 409 }), context.session);
    }
    const { data: validation } = await context.database.from("game_id_validations")
      .select("id,epic_account_id,status").eq("id", parsed.data.validationId)
      .eq("commerce_session_id", context.session.id).maybeSingle();
    if (!validation) return attachCommerceCookie(NextResponse.json({ error: "El ID validado ya no está disponible." }, { status: 409 }), context.session);
    if (validation.status !== "ready") return attachCommerceCookie(NextResponse.json({ error: "El ID de entrega aún no está listo. Actualiza su estado antes de confirmar." }, { status: 409 }), context.session);

    const quoteLines = Array.isArray(quote.checkout_quote_items) ? quote.checkout_quote_items : [];
    const catalog = await (await getCatalogService()).list();
    const currentItems = new Map(catalog.map((item) => [item.mainId, item]));
    const offersRemainAvailable = quoteLines.length > 0 && quoteLines.every((line) => {
      const current = currentItems.get(line.item_main_id);
      return current && canPurchase(current) && current.offerId === line.offer_id && (!useWallet || current.finalPriceVbucks === line.vbucks_price);
    });
    if (!offersRemainAvailable) {
      return attachCommerceCookie(NextResponse.json({ error: "Uno de los objetos dejó de estar disponible. Genera una nueva cotización." }, { status: 409 }), context.session);
    }

    const { data, error } = await context.database.rpc(useWallet ? "create_wallet_order" : "create_order_from_quote", useWallet ? {
      p_user: context.session.user!.id, p_session: context.session.id, p_quote: parsed.data.quoteId,
      p_validation: parsed.data.validationId, p_whatsapp: parsed.data.whatsapp, p_email: parsed.data.customerEmail, p_key: parsed.data.idempotencyKey,
    } : {
      p_quote_id: parsed.data.quoteId,
      p_validation_id: parsed.data.validationId,
      p_whatsapp: parsed.data.whatsapp,
      p_email: parsed.data.customerEmail,
      p_idempotency_key: parsed.data.idempotencyKey
    });
    if (error) {
      if (error.message.includes("insufficient_balance")) return NextResponse.json({ error: "No tienes pavos suficientes para este pedido. No se descontó saldo ni se inició el envío." }, { status: 409 });
      const conflict = /quote_expired|validation_mismatch|recipient_not_ready|empty_quote|idempotency_mismatch/.test(error.message);
      return attachCommerceCookie(NextResponse.json({
        error: conflict ? "La cotización o el ID ya no son válidos. Actualiza la revisión antes de confirmar." : "No fue posible guardar el pedido."
      }, { status: conflict ? 409 : 503 }), context.session);
    }
    const order = Array.isArray(data) ? data[0] : data;
    if (!order) throw new Error("La transacción no devolvió la orden.");
    if (context.session.user) await context.database.from("orders").update({ user_id: context.session.user.id }).eq("id", order.order_id);
    if (useWallet) {
      try {
        await runWalletJob(context.database, order.order_id);
      } catch (deliveryError) { console.error("wallet.delivery.queued", { orderId: order.order_id, deliveryError }); }
    }
    try {
      const job = await queueOutboxJob(context.database, {
        jobType: "telegram.order.created", aggregateId: order.order_id, payload: { orderId: order.order_id }, dedupeKey: `telegram:order:${order.order_id}`,
      });
      await deliverOutboxJob(context.database, job);
    }
    catch (deliveryError) { console.error("telegram.order.immediate.failed", deliveryError); }
    return attachCommerceCookie(NextResponse.json({ order: { id: order.order_id, publicToken: order.public_token } }, { status: 201 }), context.session);
  } catch (error) {
    console.error("cart-order.create.failed", error);
    return attachCommerceCookie(NextResponse.json({ error: "No fue posible confirmar el pedido." }, { status: 503 }), context.session);
  }
}
