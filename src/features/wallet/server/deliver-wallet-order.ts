import type { SupabaseClient } from "@supabase/supabase-js";
import { getFnShopClient, sendOperationsAlert } from "@/features/fnshop/server/get-fnshop-client";
import { deliverOrder, reconcileOrder } from "@/features/fulfillment/application/deliver-order";
import { SupabaseDeliveryStore } from "@/features/fulfillment/infrastructure/supabase-delivery-store";

export async function deliverWalletOrder(database: SupabaseClient, orderId: string) {
  const { data: order, error } = await database.from("orders").select("id,user_id,status,payment_source,updated_at").eq("id",orderId).single();
  if (error) throw error;
  if (order.payment_source !== "wallet") throw new Error("Not a wallet order");
  if (["delivered","refunded","canceled"].includes(order.status)) return;
  const fnshop = getFnShopClient(database);
  if (!fnshop) throw new Error("La entrega automática no está disponible; el pedido permanece en la cola.");
  const store = new SupabaseDeliveryStore(database);
  const deps = { store, fnshop };
  if (["paid","ready_to_send"].includes(order.status)) {
    await deliverOrder({ orderId, actorId: order.user_id, confirmPayment: false, trigger: "system", timeBudgetMs: 30000 }, deps);
  } else if (["delivering","reconciling"].includes(order.status)) {
    if (Date.now()-Date.parse(order.updated_at)<5*60000) throw new Error("Envío en curso; se comprobará en la siguiente ejecución.");
    await reconcileOrder({ orderId, actorId: order.user_id }, deps);
  } else if (order.status === "validating_delivery") {
    // This stage precedes gift_send, so reclaiming it after a crash is safe.
    if (Date.now()-Date.parse(order.updated_at)<5*60000) throw new Error("Validación en curso.");
    await store.transition(orderId,"validating_delivery","manual_review",{ reason: "Reanudando entrega automática interrumpida." });
  }
  const { error: refundError } = await database.rpc("refund_wallet_failures", { p_order: orderId });
  if (refundError) throw refundError;
  const current = await store.load(orderId);
  if (!current || ["delivered","refunded"].includes(current.status)) return;
  if (current.status === "manual_review" && current.items.length && current.items.every((item) => !item.fulfillment || ["sent","delivered"].includes(item.fulfillment.status))) {
    // Resume only items never attempted. Never retry a history-not-found or uncertain gift.
    await deliverOrder({ orderId, actorId: order.user_id, confirmPayment: false, trigger: "system", timeBudgetMs: 30000 }, deps);
    throw new Error("Comprobar resultado y devoluciones en la siguiente ejecución.");
  }
  if (["reconciling","delivering","validating_delivery"].includes(current.status)) throw new Error("Hay envíos pendientes de conciliación.");
  await sendOperationsAlert(database, `Revisar entrega con pavos #${orderId.slice(0,8)}. No reintentar ni devolver envíos inciertos sin comprobarlos.`, `wallet:attention:${orderId}`, `/admin/pedidos/${orderId}`);
}
