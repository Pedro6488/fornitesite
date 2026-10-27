import { NextResponse } from "next/server";
import { authorizeStaff } from "@/shared/server/authorize-staff";

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
