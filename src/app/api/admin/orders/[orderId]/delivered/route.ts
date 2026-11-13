import { NextResponse } from "next/server";
import { manualDeliverySteps, ORDER_STATUS_LABELS } from "@/features/admin/application/order-queues";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { authorizeStaff } from "@/shared/server/authorize-staff";

/**
 * Entrega manual en un solo paso: el administrador ya envió el regalo en
 * Fortnite y el pedido recorre los estados que faltan hasta «Entregado».
 * Cada cambio usa la misma transición auditada que el avance paso por paso.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { orderId } = await params;
  const orders = new SupabaseOrderRepository(staff.database);
  const order = await orders.findById(orderId);
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  const steps = manualDeliverySteps(order.status);
  if (!steps.length) return NextResponse.json({ error: `Un pedido en «${ORDER_STATUS_LABELS[order.status]}» no se puede marcar como entregado.` }, { status: 409 });

  let current = order.status;
  for (const next of steps) {
    try {
      const changed = await orders.transition(order.id, current, next, { actor_id: staff.user.id });
      if (!changed) return NextResponse.json({ error: "El pedido cambió mientras se actualizaba; revisa su estado antes de continuar.", status: current }, { status: 409 });
    } catch (error) {
      console.error("admin.orders.delivered.failed", { orderId: order.id, from: current, to: next, error });
      return NextResponse.json({ error: `El pedido quedó en «${ORDER_STATUS_LABELS[current]}». Intenta de nuevo.`, status: current }, { status: 409 });
    }
    current = next;
  }
  return NextResponse.json({ ok: true, status: current });
}
