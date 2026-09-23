import { NextResponse } from "next/server";
import { MercadoPagoProvider } from "@/features/payments/infrastructure/mercado-pago-provider";
import { verifyMercadoPagoSignature } from "@/features/payments/infrastructure/mercado-pago-webhook";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json() as { id?: string | number; type?: string; data?: { id?: string | number } }; const url = new URL(request.url); const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? "");
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET; const token = process.env.MERCADO_PAGO_ACCESS_TOKEN; const appUrl = process.env.NEXT_PUBLIC_APP_URL; const database = getSupabaseAdmin();
  if (!secret || !token || !appUrl || !database) return NextResponse.json({ error: "Webhook no configurado." }, { status: 503 });
  if (!verifyMercadoPagoSignature({ signature: request.headers.get("x-signature"), requestId: request.headers.get("x-request-id"), dataId, secret })) return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  const eventId = String(body.id ?? `${body.type}-${dataId}`); const { error: eventError } = await database.from("webhook_events").insert({ provider: "mercado_pago", external_event_id: eventId, event_type: body.type ?? "payment", payload: body });
  if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  try {
    const payment = await new MercadoPagoProvider(token, appUrl).getPayment(dataId); const { data: paymentRow } = await database.from("payments").select("order_id").eq("external_id", dataId).maybeSingle<{ order_id: string }>();
    const orderId = paymentRow?.order_id ?? payment.externalReference; const orders = new SupabaseOrderRepository(database); const order = await orders.findById(orderId);
    if (!order) throw new Error("Orden interna no encontrada.");
    await database.from("payments").update({ status: payment.status, confirmed_at: payment.status === "approved" ? new Date().toISOString() : null }).eq("external_id", dataId);
    if (payment.status === "approved" && order.status === "payment_pending") { await orders.transition(order.id, "payment_pending", "paid"); await orders.transition(order.id, "paid", "ready_to_send"); }
    if (payment.status === "rejected" && order.status === "payment_pending") await orders.transition(order.id, "payment_pending", "rejected");
    await database.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("provider", "mercado_pago").eq("external_event_id", eventId);
    return NextResponse.json({ received: true });
  } catch (error) {
    await database.from("webhook_events").update({ error: error instanceof Error ? error.message : "unknown" }).eq("provider", "mercado_pago").eq("external_event_id", eventId);
    console.error("mercado_pago.webhook.failed", error); return NextResponse.json({ received: true }, { status: 202 });
  }
}
