import { NextResponse } from "next/server";
import { authorizeStaff } from "@/shared/server/authorize-staff";
import sharp from "sharp";

export async function POST(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Formulario inválido." }, { status: 400 }); }
  const orderId = form.get("orderId");
  const image = form.get("image");
  const comment = String(form.get("comment") ?? "").trim();
  if (typeof orderId !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(orderId) || comment.length > 1000) {
    return NextResponse.json({ error: "Selecciona un pedido válido y usa máximo 1000 caracteres." }, { status: 400 });
  }
  if (!(image instanceof File) || !image.size || image.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
    return NextResponse.json({ error: "Adjunta una captura JPG, PNG o WEBP de máximo 5 MB." }, { status: 400 });
  }
  let bytes: Buffer;
  try {
    bytes = await sharp(Buffer.from(await image.arrayBuffer()), { limitInputPixels: 40000000 }).rotate().webp().toBuffer();
    if (bytes.length > 5 * 1024 * 1024) throw new Error("Image too large");
  } catch { return NextResponse.json({ error: "La captura no es una imagen válida o es demasiado grande." }, { status: 400 }); }
  const database = staff.database;
  const { data: order, error: orderError } = await database.from("orders").select("id,status").eq("id", orderId).maybeSingle();
  if (orderError) return NextResponse.json({ error: "No fue posible consultar el pedido." }, { status: 503 });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  if (order.status !== "delivered") return NextResponse.json({ error: "Solo puedes publicar referencias de pedidos entregados." }, { status: 409 });
  const { data: existing, error: existingError } = await database.from("delivery_feedback").select("id").eq("order_id", orderId).maybeSingle();
  if (existingError) return NextResponse.json({ error: "No fue posible consultar las referencias." }, { status: 503 });
  if (existing) return NextResponse.json({ error: "Este pedido ya tiene una referencia publicada." }, { status: 409 });
  const path = `delivery-feedback/${orderId}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await database.storage.from("delivery-feedback").upload(path, bytes, { contentType: "image/webp", upsert: false });
  if (uploadError) return NextResponse.json({ error: "No fue posible guardar la captura." }, { status: 503 });
  const { error } = await database.from("delivery_feedback").insert({ order_id: orderId, comment: comment || null, image_storage_path: path, image_mime_type: "image/webp", image_size_bytes: bytes.length });
  if (error) {
    await database.storage.from("delivery-feedback").remove([path]);
    return NextResponse.json({ error: error.code === "23505" ? "Este pedido ya tiene una referencia publicada." : "No fue posible publicar la referencia." }, { status: error.code === "23505" ? 409 : 503 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data, error } = await staff.database
    .from("delivery_feedback")
    .select("order_id,comment,image_storage_path,created_at,delivery_feedback_images(storage_path,sort_order),orders!inner(id,status,epic_display_name,epic_account_id,order_items(item_name,item_image_url,quantity))")
    .eq("orders.status", "delivered")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "No fue posible consultar las referencias." }, { status: 503 });

  const references = await Promise.all((data ?? []).map(async (reference) => {
    const order = Array.isArray(reference.orders) ? reference.orders[0] : reference.orders;
    const imagePaths = [
      ...(reference.image_storage_path ? [reference.image_storage_path] : []),
      ...(reference.delivery_feedback_images ?? []).toSorted((left, right) => left.sort_order - right.sort_order).map((image) => image.storage_path),
    ];
    const imageUrls = await Promise.all(imagePaths.map(async (path) => {
      const image = await staff.database.storage.from("delivery-feedback").createSignedUrl(path, 10 * 60);
      return image.data?.signedUrl ?? null;
    }));
    return {
      id: reference.order_id,
      recipientName: order?.epic_display_name ?? "Cliente",
      recipientId: order?.epic_account_id ?? "",
      comment: reference.comment,
      createdAt: reference.created_at,
      imageUrls: imageUrls.filter((url): url is string => Boolean(url)),
      items: order?.order_items ?? [],
    };
  }));

  return NextResponse.json({ references });
}
