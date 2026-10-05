import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import { consumeCommerceRateLimit } from "@/shared/server/commerce-rate-limit";

const extensions = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["application/pdf", "pdf"]]);

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const database = getSupabaseAdmin();
  const form = await request.formData();
  const access = form.get("access");
  const ticket = form.get("ticket");
  if (!database || typeof access !== "string" || !(ticket instanceof File)) return NextResponse.json({ error: "Datos del comprobante inválidos." }, { status: 400 });
  const extension = extensions.get(ticket.type);
  if (!extension || ticket.size === 0 || ticket.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Usa JPG, PNG o PDF de máximo 5 MB." }, { status: 400 });
  const orders = new SupabaseOrderRepository(database);
  const order = await orders.findByPublicToken(orderId, access);
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  if (order.status !== "awaiting_transfer" && order.status !== "information_required") return NextResponse.json({ error: "Este pedido no admite otro comprobante." }, { status: 409 });
  try {
    if (!await consumeCommerceRateLimit(database, orderId, "receipt.upload", 10, 3600)) {
      return NextResponse.json({ error: "Se alcanzó el límite de comprobantes. Espera antes de volver a intentar." }, { status: 429 });
    }
  } catch (error) {
    console.error("receipt.rate-limit.failed", error);
    return NextResponse.json({ error: "No fue posible validar la carga." }, { status: 503 });
  }
  const bytes = Buffer.from(await ticket.arrayBuffer());
  if (!validSignature(bytes, ticket.type)) return NextResponse.json({ error: "El contenido del archivo no coincide con su formato." }, { status: 400 });
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const path = `payment-tickets/${orderId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await database.storage.from("transfer-receipts").upload(path, bytes, { contentType: ticket.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "No fue posible guardar el comprobante." }, { status: 503 });
  const { error: receiptError } = await database.from("transfer_receipts").insert({ order_id: orderId, storage_path: path, mime_type: ticket.type, size_bytes: ticket.size, checksum });
  if (receiptError) {
    await database.storage.from("transfer-receipts").remove([path]);
    return NextResponse.json({ error: "No fue posible registrar el comprobante." }, { status: 503 });
  }
  const changed = await orders.transition(order.id, order.status, "receipt_submitted", { receipt_checksum: checksum });
  if (!changed) return NextResponse.json({ error: "El estado del pedido cambió mientras subías el comprobante." }, { status: 409 });
  return NextResponse.json({ ok: true });
}

function validSignature(bytes: Buffer, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  return false;
}
