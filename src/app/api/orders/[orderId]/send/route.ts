import { NextResponse } from "next/server";
import { z } from "zod";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { FnShopFulfillmentProvider } from "@/features/fulfillment/infrastructure/fnshop-fulfillment-provider";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

const schema = z.object({ access: z.uuid() });
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params; const parsed = schema.safeParse(await request.json()); const database = getSupabaseAdmin(); const apiKey = process.env.FNSHOP_API_KEY;
  if (!parsed.success) return NextResponse.json({ error: "Acceso inválido." }, { status: 400 });
  if (!database || !apiKey) return NextResponse.json({ error: "La entrega todavía no está configurada." }, { status: 503 });
  const orders = new SupabaseOrderRepository(database); const order = await orders.findByPublicToken(orderId, parsed.data.access);
  if (!order || order.status !== "ready_to_send") return NextResponse.json({ error: "La orden todavía no está lista para enviar." }, { status: 409 });
  if (!(await orders.transition(order.id, "ready_to_send", "validating_delivery"))) return NextResponse.json({ error: "La orden ya está siendo procesada." }, { status: 409 });
  const provider = new FnShopFulfillmentProvider(process.env.FNSHOP_API_BASE_URL ?? "https://fnitem.shop/api/v3/service", apiKey);
  const gift = { offerId: order.offerId, receiver: order.epicDisplayName, receiverId: order.epicAccountId };
  try {
    const check = await provider.check(gift); if (!check.available) { await orders.transition(order.id, "validating_delivery", "manual_review", { reason: check.reason }); return NextResponse.json({ error: check.reason ?? "No hay un agente disponible." }, { status: 409 }); }
    await orders.transition(order.id, "validating_delivery", "delivering"); const result = await provider.send({ ...gift, orderId: order.id });
    await database.from("fulfillments").upsert({ order_id: order.id, provider: "fnshop", external_id: result.externalId, status: "delivered", attempts: 1, provider_payload: result }, { onConflict: "order_id" });
    await orders.transition(order.id, "delivering", "delivered"); return NextResponse.json({ delivered: true });
  } catch (error) {
    const reconciliation = await provider.findByOrderId(order.id).catch(() => ({ delivered: false }));
    if (reconciliation.delivered) { await orders.transition(order.id, "delivering", "delivered"); return NextResponse.json({ delivered: true, reconciled: true }); }
    await orders.transition(order.id, "delivering", "manual_review", { error: error instanceof Error ? error.message : "unknown" });
    console.error("fulfillment.send.failed", error); return NextResponse.json({ error: "No pudimos confirmar el envío. El pedido pasó a revisión y no se repetirá automáticamente." }, { status: 503 });
  }
}
