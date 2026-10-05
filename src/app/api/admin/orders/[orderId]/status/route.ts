import { NextResponse } from "next/server";
import { z } from "zod";
import { ORDER_STATUSES } from "@/features/orders/domain/order";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { authorizeStaff } from "@/shared/server/authorize-staff";

const schema = z.object({ status: z.enum(ORDER_STATUSES), notes: z.string().trim().max(500).optional() })
  .refine((value) => !["information_required", "rejected", "canceled"].includes(value.status) || Boolean(value.notes && value.notes.length >= 3), {
    message: "La transición requiere una nota.", path: ["notes"]
  });
export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  const { orderId } = await params;
  const orders = new SupabaseOrderRepository(staff.database);
  const order = await orders.findById(orderId);
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  try {
    const changed = await orders.transition(order.id, order.status, parsed.data.status, { actor_id: staff.user.id, notes: parsed.data.notes });
    return changed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "El pedido cambió; actualiza antes de continuar." }, { status: 409 });
  } catch {
    return NextResponse.json({ error: `No se permite cambiar de ${order.status} a ${parsed.data.status}.` }, { status: 409 });
  }
}
