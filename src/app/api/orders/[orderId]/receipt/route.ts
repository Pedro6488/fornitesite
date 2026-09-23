import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

const allowedTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params; const form = await request.formData(); const access = String(form.get("access") ?? ""); const file = form.get("receipt"); const database = getSupabaseAdmin();
  if (!database || !(file instanceof File) || !allowedTypes[file.type] || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Comprobante inválido. Usa JPG, PNG o PDF de hasta 5 MB." }, { status: 400 });
  const orders = new SupabaseOrderRepository(database); const order = await orders.findByPublicToken(orderId, access);
  if (!order || !["awaiting_transfer", "information_required"].includes(order.status)) return NextResponse.json({ error: "Esta orden no acepta comprobantes." }, { status: 409 });
  const path = `${order.id}/${randomUUID()}.${allowedTypes[file.type]}`; const { error: uploadError } = await database.storage.from("transfer-receipts").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "No fue posible guardar el comprobante." }, { status: 503 });
  const { error } = await database.from("transfer_receipts").insert({ order_id: order.id, storage_path: path, sender_bank: String(form.get("senderBank") ?? ""), sender_name: String(form.get("senderName") ?? ""), transfer_reference: String(form.get("reference") ?? "") });
  if (error) return NextResponse.json({ error: "No fue posible registrar el comprobante." }, { status: 503 });
  const moved = await orders.transition(order.id, order.status, "receipt_submitted"); if (moved) await orders.transition(order.id, "receipt_submitted", "transfer_review");
  return NextResponse.json({ accepted: true }, { status: 201 });
}
