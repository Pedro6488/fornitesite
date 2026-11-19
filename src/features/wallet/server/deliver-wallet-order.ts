import type { SupabaseClient } from "@supabase/supabase-js";
import { getFnShopClient, sendOperationsAlert } from "@/features/fnshop/server/get-fnshop-client";
import { deliverOrder, reconcileOrder, type DeliveryReport } from "@/features/fulfillment/application/deliver-order";
import { SupabaseDeliveryStore } from "@/features/fulfillment/infrastructure/supabase-delivery-store";
import { pauseWalletPayments, walletPaymentsPaused } from "./wallet-pause";

export async function deliverWalletOrder(database: SupabaseClient, orderId: string) {
  const { data: order, error } = await database.from("orders").select("id,user_id,status,payment_source,updated_at").eq("id",orderId).single();
  if (error) throw error;
  if (order.payment_source !== "wallet") throw new Error("Not a wallet order");
  if (["delivered","refunded","canceled"].includes(order.status)) return;
  const fnshop = getFnShopClient(database);
  if (!fnshop) throw new Error("La entrega automática no está disponible; el pedido permanece en la cola.");
  const store = new SupabaseDeliveryStore(database);
  const deps = { store, fnshop };
  let senderDown = false;
  const track = (report: DeliveryReport | undefined) => { if (report?.senderDown) senderDown = true; };
  if (["paid","ready_to_send"].includes(order.status)) {
    track(await deliverOrder({ orderId, actorId: order.user_id, confirmPayment: false, trigger: "system", timeBudgetMs: 30000 }, deps));
  } else if (["delivering","reconciling"].includes(order.status)) {
    if (Date.now()-Date.parse(order.updated_at)<5*60000) throw new Error("Envío en curso; se comprobará en la siguiente ejecución.");
    await reconcileOrder({ orderId, actorId: order.user_id }, deps);
  } else if (order.status === "validating_delivery") {
    // This stage precedes gift_send, so reclaiming it after a crash is safe.
    if (Date.now()-Date.parse(order.updated_at)<5*60000) throw new Error("Validación en curso.");
    await store.transition(orderId,"validating_delivery","manual_review",{ reason: "Reanudando entrega automática interrumpida." });
  }
  if (senderDown) await pauseAndAlert(database, orderId);
  // With the sender down, never-attempted items are refunded now instead of one per cron pass.
  const paused = senderDown || await walletPaymentsPaused(database);
  const { error: refundError } = await database.rpc("refund_wallet_failures", { p_order: orderId, p_include_unattempted: paused });
  if (refundError) throw refundError;
  const current = await store.load(orderId);
  if (!current || ["delivered","refunded"].includes(current.status)) return;
  if (!paused && current.status === "manual_review" && current.items.length && current.items.every((item) => !item.fulfillment || ["sent","delivered"].includes(item.fulfillment.status))) {
    // Resume only items never attempted. Never retry a history-not-found or uncertain gift.
    const report = await deliverOrder({ orderId, actorId: order.user_id, confirmPayment: false, trigger: "system", timeBudgetMs: 30000 }, deps);
    if (report.senderDown) await pauseAndAlert(database, orderId);
    throw new Error("Comprobar resultado y devoluciones en la siguiente ejecución.");
  }
  if (["reconciling","delivering","validating_delivery"].includes(current.status)) throw new Error("Hay envíos pendientes de conciliación.");
  await sendOperationsAlert(database, `Revisar entrega con pavos #${orderId.slice(0,8)}. No reintentar ni devolver envíos inciertos sin comprobarlos.`, `wallet:attention:${orderId}`, `/admin/pedidos/${orderId}`);
}

async function pauseAndAlert(database: SupabaseClient, orderId: string) {
  const until = await pauseWalletPayments(database, `Falla de la cuenta emisora en el pedido #${orderId.slice(0, 8).toUpperCase()}`);
  const hour = new Date().toISOString().slice(0, 13);
  await sendOperationsAlert(database,
    `⏸️ Pausé el pago con pavos${until ? ` hasta las ${new Date(until).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" })}` : ""}: falló la cuenta emisora en el pedido #${orderId.slice(0, 8).toUpperCase()}. Los objetos no enviados se devuelven al saldo. Revisa FN Shop y reanuda desde /admin/pavos.`,
    `wallet:paused:${hour}`, "/admin/pavos");
}
