import type { OrderStatus } from "@/features/orders/domain/order";
import { fnShopReceiver, validReceiverId } from "@/features/commerce/application/fnshop-identity";
import { FnShopTransportError, FnShopUnavailableError, type FnShopCaller } from "@/shared/infrastructure/fnshop/fnshop-client";
import { interpretGiftCheck, interpretGiftSend, needsSenderAttention, type GiftCheckResult } from "./gift-results";

/**
 * Entrega de un pedido con FN Shop, objeto por objeto.
 *
 * Reglas que no se rompen:
 *  1. La fila del objeto se aparta en `sending` ANTES de llamar a gift_send.
 *     Si ya está en sending, unknown o sent, no se vuelve a enviar (doble clic, dos admins).
 *  2. Un resultado dudoso (gift_outcome_unknown, timeout, corte) queda `unknown` y el
 *     pedido pasa a «Conciliando». Nunca se reintenta solo: `order_history` decide.
 *  3. Un rechazo deja el objeto `failed` y el pedido en revisión manual con el motivo.
 */
export type FulfillmentStatus = "queued" | "sending" | "sent" | "unknown" | "failed" | "delivered";

export type DeliveryItem = Readonly<{
  id: string; itemMainId: string; offerId: string; name: string; vbucksPrice: number;
  fulfillment: Readonly<{ status: FulfillmentStatus; startedAt: string | null }> | null;
}>;

export type DeliveryOrder = Readonly<{
  id: string; status: OrderStatus; displayName: string; platform: string;
  epicAccountId: string; providerReceiverId: string | null; items: readonly DeliveryItem[];
}>;

export type ItemFinish =
  | { status: "sent"; trackId: string | null; senderId: string | null; senderName: string | null; finalPrice: number | null; code: string }
  | { status: "unknown" | "failed"; code: string; message: string; senderId?: string | null; senderName?: string | null };

export interface DeliveryStore {
  load(orderId: string): Promise<DeliveryOrder | null>;
  transition(orderId: string, from: OrderStatus, to: OrderStatus, metadata: Record<string, unknown>): Promise<boolean>;
  /** Aparta el objeto en `sending`. Solo gana si no existía o estaba `failed`. */
  claim(order: DeliveryOrder, item: DeliveryItem, input: { receiver: string; receiverId: string | null; actorId: string }): Promise<boolean>;
  finish(itemId: string, result: ItemFinish): Promise<void>;
  updateOffer(itemId: string, offerId: string): Promise<void>;
  alert(text: string, dedupeKey: string, orderId: string): Promise<void>;
}

export type ItemReport = Readonly<{ itemId: string; name: string; result: "sent" | "unknown" | "failed" | "skipped" | "not_attempted"; message: string | null }>;
export type DeliveryReport = Readonly<{ status: OrderStatus; items: readonly ItemReport[]; message: string }>;

export class DeliveryError extends Error {
  constructor(message: string, readonly httpStatus: number) {
    super(message);
    this.name = "DeliveryError";
  }
}

/** Antes de confirmar el pago; el admin puede pedir «Confirmar pago y enviar regalo». */
export const PAYMENT_CONFIRMABLE: readonly OrderStatus[] = ["awaiting_transfer", "receipt_submitted", "transfer_review", "information_required"];
/** Desde aquí se puede empezar (o retomar) un envío. */
export const SENDABLE: readonly OrderStatus[] = ["paid", "ready_to_send", "manual_review"];

const DONE: readonly FulfillmentStatus[] = ["sent", "delivered"];
const LOCKED: readonly FulfillmentStatus[] = ["sending", "unknown", ...DONE];
const STUCK_SENDING_MS = 5 * 60_000;

function recipient(order: DeliveryOrder) {
  return {
    receiver: fnShopReceiver(order.platform, order.displayName),
    receiverId: order.providerReceiverId ?? validReceiverId(order.epicAccountId),
  };
}

function giftParams(order: DeliveryOrder, item: DeliveryItem, category: string | null, extra: Record<string, string> = {}) {
  const { receiver, receiverId } = recipient(order);
  return { offerId: item.offerId, receiver, ...(receiverId ? { receiver_id: receiverId } : {}), ...(category ? { category } : {}), ...extra };
}

/** Objetos que todavía hay que enviar. */
export function pendingItems(order: DeliveryOrder): readonly DeliveryItem[] {
  return order.items.filter((item) => !item.fulfillment || !LOCKED.includes(item.fulfillment.status));
}

export type PreflightItem = Readonly<{ itemId: string; name: string; vbucksPrice: number; offerRefreshed: boolean } & GiftCheckResult>;

/**
 * Pre-vuelo: un gift_check por objeto pendiente. No envía nada ni cambia el pedido.
 * Si el offerId venció, busca el vigente con `shop` y vuelve a revisar (2 requests más).
 */
export async function preflightOrder(orderId: string, deps: { store: DeliveryStore; fnshop: FnShopCaller; actorId: string }): Promise<readonly PreflightItem[]> {
  const order = await deps.store.load(orderId);
  if (!order) throw new DeliveryError("Pedido no encontrado.", 404);
  if (![...PAYMENT_CONFIRMABLE, ...SENDABLE].includes(order.status)) throw new DeliveryError("Este pedido no está listo para enviar.", 409);
  const items = pendingItems(order);
  if (!items.length) throw new DeliveryError("Todos los objetos de este pedido ya se enviaron o están en conciliación.", 409);

  const results: PreflightItem[] = [];
  for (const item of items) {
    const context = { trigger: "admin" as const, actorId: deps.actorId, orderId: order.id, orderItemId: item.id };
    let current = item;
    let response = await deps.fnshop.call("gift_check", giftParams(order, current, deps.fnshop.config.category), context);
    let check = interpretGiftCheck(response.body);
    await deps.fnshop.decide(response.callId, check.eligible ? "eligible" : check.code);
    let offerRefreshed = false;
    if (!check.eligible && check.code === "catalog_out_of_date") {
      const shop = await deps.fnshop.call("shop", { search: item.name, giftable: "1", limit: "20" }, context);
      const items = Array.isArray(shop.body.items) ? shop.body.items as Record<string, unknown>[] : [];
      const match = items.find((entry) => entry.mainId === item.itemMainId && typeof entry.offerId === "string");
      await deps.fnshop.decide(shop.callId, match ? "offer_found" : "offer_missing");
      if (match && match.offerId !== item.offerId) {
        await deps.store.updateOffer(item.id, String(match.offerId));
        current = { ...item, offerId: String(match.offerId) };
        response = await deps.fnshop.call("gift_check", giftParams(order, current, deps.fnshop.config.category), context);
        check = interpretGiftCheck(response.body);
        await deps.fnshop.decide(response.callId, check.eligible ? "eligible" : check.code);
        offerRefreshed = true;
      } else if (!match) {
        check = { ...check, message: "El objeto ya no está en la tienda de Fortnite. Ofrece cambio o reembolso." };
      }
    }
    results.push({ itemId: item.id, name: item.name, vbucksPrice: item.vbucksPrice, offerRefreshed, ...check });
  }
  return results;
}

async function step(store: DeliveryStore, order: { id: string }, from: OrderStatus, to: OrderStatus, metadata: Record<string, unknown>) {
  if (!await store.transition(order.id, from, to, metadata)) {
    throw new DeliveryError("El pedido cambió mientras se procesaba. Actualiza la página y revisa su estado.", 409);
  }
  return to;
}

/**
 * Envía los objetos pendientes. Con `confirmPayment`, primero confirma el pago.
 * Termina el pedido como «Entregado», «Conciliando» o «Revisión manual».
 */
export async function deliverOrder(
  input: { orderId: string; actorId: string; confirmPayment: boolean; timeBudgetMs?: number },
  deps: { store: DeliveryStore; fnshop: FnShopCaller; now?: () => number },
): Promise<DeliveryReport> {
  const now = deps.now ?? Date.now;
  const started = now();
  const budget = input.timeBudgetMs ?? 40_000;
  const { store, fnshop } = deps;
  const order = await store.load(input.orderId);
  if (!order) throw new DeliveryError("Pedido no encontrado.", 404);
  const actor = { actor_id: input.actorId };

  let status = order.status;
  if (PAYMENT_CONFIRMABLE.includes(status)) {
    if (!input.confirmPayment) throw new DeliveryError("Primero confirma el pago.", 409);
    status = await step(store, order, status, "paid", { ...actor, notes: "Pago confirmado manualmente por el administrador." });
  }
  if (!SENDABLE.includes(status) && status !== "ready_to_send") {
    throw new DeliveryError(status === "validating_delivery" || status === "delivering"
      ? "Este pedido ya se está enviando. Si lleva varios minutos así, usa «Conciliar»."
      : "Este pedido no se puede enviar en su estado actual.", 409);
  }
  if (status !== "ready_to_send") status = await step(store, order, status, "ready_to_send", actor);
  status = await step(store, order, status, "validating_delivery", actor);
  status = await step(store, order, status, "delivering", actor);

  const { receiver, receiverId } = recipient(order);
  const reports: ItemReport[] = [];
  let stopReason: string | null = null;

  for (const item of order.items) {
    const previous = item.fulfillment?.status;
    if (previous && LOCKED.includes(previous)) {
      reports.push({ itemId: item.id, name: item.name, result: DONE.includes(previous) ? "sent" : previous === "unknown" ? "unknown" : "skipped", message: DONE.includes(previous) ? null : "Ya hay un envío en curso o por conciliar." });
      continue;
    }
    if (stopReason || now() - started > budget) {
      stopReason ??= "Se acabó el tiempo de esta solicitud; los objetos que faltan se envían con «Reintentar envío».";
      reports.push({ itemId: item.id, name: item.name, result: "not_attempted", message: stopReason });
      continue;
    }
    if (!await store.claim(order, item, { receiver, receiverId, actorId: input.actorId })) {
      reports.push({ itemId: item.id, name: item.name, result: "skipped", message: "Otro envío de este objeto ya está en curso." });
      continue;
    }
    try {
      const response = await fnshop.call("gift_send", giftParams(order, item, fnshop.config.category, { order_id: item.id }), {
        trigger: "admin", actorId: input.actorId, orderId: order.id, orderItemId: item.id,
      });
      const result = interpretGiftSend(response.body);
      await fnshop.decide(response.callId, result.outcome);
      if (result.outcome === "sent") {
        await store.finish(item.id, { status: "sent", trackId: result.trackId, senderId: result.senderId, senderName: result.senderName, finalPrice: result.finalPrice, code: response.code ?? "gift_sent_successfully" });
        reports.push({ itemId: item.id, name: item.name, result: "sent", message: null });
      } else if (result.outcome === "unknown") {
        await store.finish(item.id, { status: "unknown", code: result.code, message: result.message, senderId: result.senderId, senderName: result.senderName });
        reports.push({ itemId: item.id, name: item.name, result: "unknown", message: result.message });
      } else {
        await store.finish(item.id, { status: "failed", code: result.code, message: result.message });
        reports.push({ itemId: item.id, name: item.name, result: "failed", message: result.message });
        if (needsSenderAttention(result.reasons, result.code)) {
          await store.alert(`⚠️ FN Shop rechazó un regalo del pedido #${order.id.slice(0, 8).toUpperCase()}: ${result.message}`, `fnshop:sender:${result.code}:${result.reasons.join(",")}:${new Date(started).toISOString().slice(0, 13)}`, order.id);
          // Sin saldo o sin cupo, los demás objetos fallarían igual: no se gastan más requests.
          if (result.reasons.includes("vbucks") || result.reasons.includes("gifts") || result.code === "plan_limit_reached") stopReason = result.message;
        }
      }
    } catch (error) {
      if (error instanceof FnShopUnavailableError) {
        // No salió ninguna llamada: el objeto se libera para reintentarlo después.
        await store.finish(item.id, { status: "failed", code: `not_sent:${error.reason}`, message: error.message });
        reports.push({ itemId: item.id, name: item.name, result: "failed", message: error.message });
        stopReason = error.message;
      } else {
        // La llamada pudo haber llegado a Epic: resultado dudoso.
        const message = error instanceof FnShopTransportError ? `Sin respuesta de FN Shop (${error.message}). Concilia antes de reintentar.` : "Error inesperado durante el envío. Concilia antes de reintentar.";
        await store.finish(item.id, { status: "unknown", code: "transport_error", message });
        reports.push({ itemId: item.id, name: item.name, result: "unknown", message });
        console.error("fulfillment.gift_send.failed", { orderId: order.id, itemId: item.id, error });
      }
    }
  }

  return settle(store, order.id, status, reports, actor);
}

async function settle(store: DeliveryStore, orderId: string, from: OrderStatus, reports: readonly ItemReport[], actor: Record<string, unknown>): Promise<DeliveryReport> {
  const sent = reports.filter((report) => report.result === "sent").length;
  const unknown = reports.filter((report) => report.result === "unknown" || report.result === "skipped").length;
  const failed = reports.filter((report) => report.result === "failed" || report.result === "not_attempted");
  if (sent === reports.length) {
    const status = await step(store, { id: orderId }, from, "delivered", actor);
    return { status, items: reports, message: `Se enviaron los ${sent} ${sent === 1 ? "objeto" : "objetos"}. El pedido quedó entregado.` };
  }
  if (unknown > 0) {
    const status = from === "reconciling" ? from : await step(store, { id: orderId }, from, "reconciling", { ...actor, reason: "Hay envíos sin confirmar." });
    return { status, items: reports, message: "Hay envíos sin confirmar. Usa «Conciliar» antes de reintentar; no se volverán a enviar solos." };
  }
  const reason = failed.map((report) => `${report.name}: ${report.message ?? "sin motivo"}`).join(" · ");
  const status = await step(store, { id: orderId }, from, "manual_review", { ...actor, reason });
  return { status, items: reports, message: sent ? `Se enviaron ${sent} de ${reports.length} objetos. Revisa los que faltan.` : "No se envió ningún objeto. Revisa el motivo." };
}

/**
 * Conciliación: busca en `order_history` cada objeto con resultado dudoso
 * (o en `sending` desde hace más de 5 minutos) usando su id como `order_id`.
 */
export async function reconcileOrder(
  input: { orderId: string; actorId: string },
  deps: { store: DeliveryStore; fnshop: FnShopCaller; now?: () => number },
): Promise<DeliveryReport> {
  const now = deps.now ?? Date.now;
  const order = await deps.store.load(input.orderId);
  if (!order) throw new DeliveryError("Pedido no encontrado.", 404);
  if (order.status !== "reconciling" && order.status !== "delivering") throw new DeliveryError("Solo se concilian pedidos en «Conciliando» o «Enviando».", 409);
  const { receiverId } = recipient(order);

  const reports: ItemReport[] = [];
  for (const item of order.items) {
    const fulfillment = item.fulfillment;
    if (fulfillment && DONE.includes(fulfillment.status)) { reports.push({ itemId: item.id, name: item.name, result: "sent", message: null }); continue; }
    const stuck = fulfillment?.status === "sending" && (!fulfillment.startedAt || now() - Date.parse(fulfillment.startedAt) > STUCK_SENDING_MS);
    if (fulfillment?.status !== "unknown" && !stuck) {
      reports.push({ itemId: item.id, name: item.name, result: fulfillment?.status === "sending" ? "skipped" : "failed", message: fulfillment?.status === "sending" ? "Envío en curso." : "No se envió." });
      continue;
    }
    try {
      const response = await deps.fnshop.call("order_history", { order_id: item.id, type: "api_gift", ...(receiverId ? { receiver: receiverId } : {}) }, {
        trigger: "admin", actorId: input.actorId, orderId: order.id, orderItemId: item.id,
      });
      const orders = Array.isArray(response.body.orders) ? response.body.orders as Record<string, unknown>[] : [];
      const found = orders.find((entry) => String(entry.order_id ?? "") === item.id);
      if (found && (found.status === "completed" || found.status === undefined)) {
        await deps.fnshop.decide(response.callId, "found_sent");
        await deps.store.finish(item.id, { status: "sent", trackId: typeof found.id === "string" ? found.id : null, senderId: typeof found.sender === "string" ? found.sender : null, senderName: null, finalPrice: typeof found.price === "number" ? found.price : null, code: "reconciled" });
        reports.push({ itemId: item.id, name: item.name, result: "sent", message: "Confirmado en el historial de FN Shop." });
      } else {
        await deps.fnshop.decide(response.callId, found ? `found_${String(found.status)}` : "not_found");
        await deps.store.finish(item.id, { status: "failed", code: "not_in_history", message: "No aparece en el historial de FN Shop. Revisa en Fortnite antes de reintentar." });
        reports.push({ itemId: item.id, name: item.name, result: "failed", message: "No aparece en el historial de FN Shop. Revisa en Fortnite antes de reintentar." });
      }
    } catch (error) {
      reports.push({ itemId: item.id, name: item.name, result: "unknown", message: error instanceof Error ? error.message : "No se pudo consultar el historial." });
    }
  }
  return settle(deps.store, order.id, order.status, reports, { actor_id: input.actorId });
}
