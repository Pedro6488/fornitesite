import { NextResponse } from "next/server";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

const allowedTypes = new Set(["image/jpeg", "image/png"]);
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params; const database = getSupabaseAdmin(); const form = await request.formData(); const access = form.get("access"); const ticket = form.get("ticket");
  if (!database || typeof access !== "string" || !(ticket instanceof File)) return NextResponse.json({ error: "Datos del comprobante inválidos." }, { status: 400 });
  if (!allowedTypes.has(ticket.type) || ticket.size === 0 || ticket.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Usa una imagen JPG o PNG de máximo 5 MB." }, { status: 400 });
  const order = await new SupabaseOrderRepository(database).findByPublicToken(orderId, access); if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  const extension = ticket.type === "image/png" ? "png" : "jpg"; const path = `payment-tickets/${orderId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await database.storage.from("transfer-receipts").upload(path, ticket, { contentType: ticket.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "No fue posible guardar la imagen." }, { status: 503 });
  const { error: ticketError } = await database.from("order_payment_tickets").upsert({ order_id: orderId, storage_path: path, mime_type: ticket.type }, { onConflict: "order_id" });
  if (ticketError) return NextResponse.json({ error: "No fue posible registrar el comprobante." }, { status: 503 });
  await database.from("orders").update({ supervisor_status: "submitted_to_administrator", supervisor_status_updated_at: new Date().toISOString() }).eq("id", orderId);
  return NextResponse.json({ ok: true });
}
