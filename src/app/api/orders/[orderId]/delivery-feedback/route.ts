import { NextResponse } from "next/server";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import { consumeCommerceRateLimit } from "@/shared/server/commerce-rate-limit";

const extensions = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maximumImageSize = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const database = getSupabaseAdmin();
  const form = await request.formData();
  const access = form.get("access");
  const images = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  const commentValue = form.get("comment");
  const comment = typeof commentValue === "string" ? commentValue.trim() : "";

  if (!database || typeof access !== "string") return NextResponse.json({ error: "Datos de confirmación inválidos." }, { status: 400 });
  if (comment.length > 1000) return NextResponse.json({ error: "El comentario no puede superar los 1000 caracteres." }, { status: 400 });
  if (images.length > 3) return NextResponse.json({ error: "Puedes enviar un máximo de tres imágenes." }, { status: 400 });
  if (!comment && images.length === 0) return NextResponse.json({ error: "Agrega un comentario o una imagen para enviar la confirmación." }, { status: 400 });

  const orders = new SupabaseOrderRepository(database);
  const order = await orders.findByPublicToken(orderId, access);
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  if (order.status !== "delivered") return NextResponse.json({ error: "La confirmación sólo está disponible cuando el pedido fue entregado." }, { status: 409 });
  try {
    if (!await consumeCommerceRateLimit(database, orderId, "delivery.feedback", 10, 3600)) return NextResponse.json({ error: "Espera antes de volver a enviar una confirmación." }, { status: 429 });
  } catch (error) {
    console.error("delivery-feedback.rate-limit.failed", error);
    return NextResponse.json({ error: "No fue posible validar la confirmación." }, { status: 503 });
  }

  const { data: existingFeedback, error: existingFeedbackError } = await database.from("delivery_feedback").select("id").eq("order_id", order.id).maybeSingle();
  if (existingFeedbackError) return NextResponse.json({ error: "No fue posible consultar la confirmación anterior." }, { status: 503 });
  if (existingFeedback) return NextResponse.json({ error: "Ya recibimos tu referencia de entrega. Gracias." }, { status: 409 });

  const uploadedImages: { storagePath: string; mimeType: string; sizeBytes: number }[] = [];
  for (const image of images) {
    const extension = extensions.get(image.type);
    if (!extension || image.size > maximumImageSize) {
      await removeUploadedImages(database, uploadedImages);
      return NextResponse.json({ error: "Usa JPG, PNG o WEBP de máximo 5 MB por imagen." }, { status: 400 });
    }
    const bytes = Buffer.from(await image.arrayBuffer());
    if (!validImageSignature(bytes, image.type)) {
      await removeUploadedImages(database, uploadedImages);
      return NextResponse.json({ error: "El contenido de una imagen no coincide con su formato." }, { status: 400 });
    }
    const storagePath = `delivery-feedback/${order.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await database.storage.from("delivery-feedback").upload(storagePath, bytes, { contentType: image.type, upsert: false });
    if (uploadError) {
      await removeUploadedImages(database, uploadedImages);
      return NextResponse.json({ error: "No fue posible guardar una imagen." }, { status: 503 });
    }
    uploadedImages.push({ storagePath, mimeType: image.type, sizeBytes: image.size });
  }

  const { data: feedback, error: feedbackError } = await database
    .from("delivery_feedback")
    .insert({ order_id: order.id, comment: comment || null, image_storage_path: null, image_mime_type: null, image_size_bytes: null, updated_at: new Date().toISOString() })
    .select("id")
    .single();
  if (feedbackError) {
    await removeUploadedImages(database, uploadedImages);
    return NextResponse.json({ error: "No fue posible registrar la confirmación." }, { status: 503 });
  }

  if (uploadedImages.length) {
    const { error: imageRecordError } = await database.from("delivery_feedback_images").insert(
      uploadedImages.map((image, index) => ({
        delivery_feedback_id: feedback.id,
        storage_path: image.storagePath,
        mime_type: image.mimeType,
        size_bytes: image.sizeBytes,
        sort_order: index + 1,
      })),
    );
    if (imageRecordError) {
      await database.from("delivery_feedback").delete().eq("id", feedback.id);
      await removeUploadedImages(database, uploadedImages);
      return NextResponse.json({ error: "No fue posible registrar las imágenes." }, { status: 503 });
    }
  }

  return NextResponse.json({ ok: true });
}

async function removeUploadedImages(database: NonNullable<ReturnType<typeof getSupabaseAdmin>>, images: { storagePath: string }[]) {
  if (images.length) await database.storage.from("delivery-feedback").remove(images.map((image) => image.storagePath));
}

function validImageSignature(bytes: Buffer, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}
