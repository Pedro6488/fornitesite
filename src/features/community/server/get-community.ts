import { rankCustomersByDeliveredOrders } from "@/features/admin/application/customer-ranking";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

export async function getPublicCustomerRanking() {
  const database = getSupabaseAdmin();
  if (!database) return [];
  const { data, error } = await database
    .from("orders")
    .select("epic_account_id,epic_display_name,customer_email,amount_mxn_cents,delivered_at,created_at")
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return rankCustomersByDeliveredOrders(data ?? []).map(({ recipientName, deliveredOrders }) => ({ recipientName, deliveredOrders }));
}

export async function getPublicDeliveryReferences() {
  const database = getSupabaseAdmin();
  if (!database) return [];
  const { data, error } = await database
    .from("delivery_feedback")
    .select("comment,image_storage_path,created_at,delivery_feedback_images(storage_path,sort_order),orders!inner(status,epic_display_name,order_items(item_name,quantity))")
    .eq("orders.status", "delivered")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  return Promise.all((data ?? []).map(async (reference) => {
    const order = Array.isArray(reference.orders) ? reference.orders[0] : reference.orders;
    const imagePaths = [
      ...(reference.image_storage_path ? [reference.image_storage_path] : []),
      ...(reference.delivery_feedback_images ?? []).toSorted((left, right) => left.sort_order - right.sort_order).map((image) => image.storage_path),
    ];
    const imageUrls = await Promise.all(imagePaths.map(async (path) => {
      const image = await database.storage.from("delivery-feedback").createSignedUrl(path, 10 * 60);
      return image.data?.signedUrl ?? null;
    }));
    return {
      recipientName: order?.epic_display_name ?? "Cliente",
      comment: reference.comment,
      createdAt: reference.created_at,
      imageUrls: imageUrls.filter((url): url is string => Boolean(url)),
      items: order?.order_items ?? [],
    };
  }));
}
