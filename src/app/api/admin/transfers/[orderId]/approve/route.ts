import { NextResponse } from "next/server";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { authorizeStaff } from "@/shared/server/authorize-staff";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const staff = await authorizeStaff(request); if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 }); const { orderId } = await params;
  const orders = new SupabaseOrderRepository(staff.database); const order = await orders.findById(orderId);
  if (!order || order.status !== "transfer_review") return NextResponse.json({ error: "La transferencia no está en revisión." }, { status: 409 });
  const { data: receipt } = await staff.database.from("transfer_receipts").select("id").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!receipt) return NextResponse.json({ error: "La orden no tiene comprobante." }, { status: 409 });
  await staff.database.from("transfer_receipts").update({ reviewed_by: staff.user.id, reviewed_at: new Date().toISOString() }).eq("id", receipt.id);
  await staff.database.from("payments").insert({ order_id: order.id, provider: "bank_transfer", status: "approved", amount_mxn_cents: order.amountMxnCents, confirmed_at: new Date().toISOString() });
  await orders.transition(order.id, "transfer_review", "paid", { approved_by: staff.user.id }); await orders.transition(order.id, "paid", "ready_to_send");
  await staff.database.from("audit_log").insert({ actor_id: staff.user.id, action: "transfer.approved", entity_type: "order", entity_id: order.id, after_data: { amount_mxn_cents: order.amountMxnCents } });
  return NextResponse.json({ approved: true });
}
