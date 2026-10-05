import { NextResponse } from "next/server";
import { z } from "zod";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

const schema = z.object({ access: z.uuid(), channel: z.literal("whatsapp") });
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const database = getSupabaseAdmin();
  if (!parsed.success || !database) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const { orderId } = await params;
  const order = await new SupabaseOrderRepository(database).findByPublicToken(orderId, parsed.data.access);
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  await database.from("order_contact_events").insert({ order_id: orderId, channel: parsed.data.channel });
  return NextResponse.json({ ok: true });
}
