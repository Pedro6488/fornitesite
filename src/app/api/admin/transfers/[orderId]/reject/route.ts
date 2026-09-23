import { NextResponse } from "next/server";
import { z } from "zod";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { authorizeStaff } from "@/shared/server/authorize-staff";

const schema = z.object({ notes: z.string().trim().min(3).max(500) });
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const staff = await authorizeStaff(request); if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 }); const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Escribe el motivo del rechazo." }, { status: 400 }); const { orderId } = await params; const orders = new SupabaseOrderRepository(staff.database); const order = await orders.findById(orderId);
  if (!order || order.status !== "transfer_review") return NextResponse.json({ error: "La transferencia no está en revisión." }, { status: 409 });
  await orders.transition(order.id, "transfer_review", "rejected", { rejected_by: staff.user.id, notes: parsed.data.notes });
  await staff.database.from("audit_log").insert({ actor_id: staff.user.id, action: "transfer.rejected", entity_type: "order", entity_id: order.id, after_data: { notes: parsed.data.notes } });
  return NextResponse.json({ rejected: true });
}
