import { NextResponse } from "next/server";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { MercadoPagoProvider } from "@/features/payments/infrastructure/mercado-pago-provider";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

export async function POST(_: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params; const database = getSupabaseAdmin(); const token = process.env.MERCADO_PAGO_ACCESS_TOKEN; const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!database || !token || !appUrl) return NextResponse.json({ error: "Mercado Pago todavía no está configurado." }, { status: 503 });
  const orders = new SupabaseOrderRepository(database); const order = await orders.findById(orderId);
  if (!order || order.paymentMethod !== "mercado_pago" || order.status !== "draft") return NextResponse.json({ error: "La orden no puede iniciar este pago." }, { status: 409 });
  try {
    const checkout = await new MercadoPagoProvider(token, appUrl).createCheckout(order);
    await database.from("payments").insert({ order_id: order.id, provider: "mercado_pago", external_id: checkout.externalId, status: "pending", amount_mxn_cents: order.amountMxnCents });
    await orders.transition(order.id, "draft", "payment_pending", { provider: "mercado_pago" });
    return NextResponse.json(checkout);
  } catch (error) { console.error("payment.checkout.failed", error); return NextResponse.json({ error: "No fue posible abrir Mercado Pago." }, { status: 503 }); }
}
