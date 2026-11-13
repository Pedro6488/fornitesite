import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/shared/server/authorize-staff";

const SIGNED_URL_SECONDS = 10 * 60;

/** Un pedido completo para su página: comprobante firmado, objetos, recomendación e historial. */
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  const { data: order, error } = await staff.database
    .from("orders")
    .select("id,created_at,paid_at,delivered_at,customer_email,epic_display_name,epic_account_id,recipient_platform,contact_whatsapp,amount_mxn_cents,currency,amount_usd_cents,status,order_items(id,item_main_id,item_name,item_image_url,vbucks_price,quantity,unit_amount_mxn_cents,unit_amount_usd_cents),transfer_receipts(id,storage_path,mime_type,created_at),delivery_feedback(comment,image_storage_path,created_at)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "No fue posible consultar el pedido." }, { status: 503 });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  const receipt = order.transfer_receipts?.toSorted((left, right) => right.created_at.localeCompare(left.created_at))[0];
  const feedback = Array.isArray(order.delivery_feedback) ? order.delivery_feedback[0] : order.delivery_feedback;
  const [signedReceipt, signedFeedback, history, fulfillments] = await Promise.all([
    receipt ? staff.database.storage.from("transfer-receipts").createSignedUrl(receipt.storage_path, SIGNED_URL_SECONDS) : null,
    feedback?.image_storage_path ? staff.database.storage.from("delivery-feedback").createSignedUrl(feedback.image_storage_path, SIGNED_URL_SECONDS) : null,
    staff.database.from("audit_log").select("action,after_data,created_at").eq("entity_type", "order").eq("entity_id", order.id).order("created_at", { ascending: false }).limit(50),
    staff.database.from("fulfillments").select("order_item_id,status,result_code,last_error,track_id,sender_name,final_price_vbucks,started_at,finished_at").eq("order_id", order.id),
  ]);

  const { transfer_receipts: _receipts, delivery_feedback: _feedback, ...fields } = order;
  void _receipts; void _feedback;
  return NextResponse.json({
    order: {
      ...fields,
      receipt: receipt ? { url: signedReceipt?.data?.signedUrl ?? null, mimeType: receipt.mime_type, createdAt: receipt.created_at } : null,
      deliveryFeedback: feedback ? { comment: feedback.comment, createdAt: feedback.created_at, imageUrl: signedFeedback?.data?.signedUrl ?? null } : null,
      history: history.data ?? [],
      fulfillments: fulfillments.data ?? [],
    },
    deliveryMode: process.env.FULFILLMENT_MODE === "fnshop" ? "automatic" : "manual",
  });
}
