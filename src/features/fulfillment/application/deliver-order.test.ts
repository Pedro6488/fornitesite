import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/features/orders/domain/order";
import { FnShopTransportError, FnShopUnavailableError, fnShopConfigFromEnv, type FnShopCaller, type FnShopResponse } from "@/shared/infrastructure/fnshop/fnshop-client";
import type { FnShopAction } from "@/shared/infrastructure/fnshop/fnshop-budget";
import { deliverOrder, preflightOrder, reconcileOrder, type DeliveryItem, type DeliveryOrder, type DeliveryStore, type FulfillmentStatus, type ItemFinish } from "./deliver-order";
import { interpretGiftSend } from "./gift-results";

const EPIC_ID = "0123456789abcdef0123456789abcdef";
const VALID: Record<string, OrderStatus[]> = {
  receipt_submitted: ["paid"], paid: ["ready_to_send"], manual_review: ["ready_to_send", "delivered"], ready_to_send: ["validating_delivery"],
  validating_delivery: ["delivering"], delivering: ["delivered", "reconciling", "manual_review"], reconciling: ["delivered", "manual_review"],
};

function item(id: string, fulfillment: FulfillmentStatus | null = null): DeliveryItem {
  return { id, itemMainId: `main-${id}`, offerId: `offer-${id}`, name: `Objeto ${id}`, vbucksPrice: 800, fulfillment: fulfillment ? { status: fulfillment, startedAt: "2026-11-13T00:00:00.000Z" } : null };
}

function fakeStore(order: DeliveryOrder) {
  let current: DeliveryOrder = order;
  const transitions: { from: OrderStatus; to: OrderStatus; metadata: Record<string, unknown> }[] = [];
  const finished: { itemId: string; result: ItemFinish }[] = [];
  const claims: { itemId: string; receiver: string; receiverId: string | null }[] = [];
  const alerts: string[] = [];
  const setFulfillment = (itemId: string, status: FulfillmentStatus) => {
    current = { ...current, items: current.items.map((entry) => entry.id === itemId ? { ...entry, fulfillment: { status, startedAt: new Date().toISOString() } } : entry) };
  };
  const store: DeliveryStore = {
    load: async () => current,
    transition: async (_id, from, to, metadata) => {
      if (current.status !== from || !VALID[from]?.includes(to)) return false;
      transitions.push({ from, to, metadata });
      current = { ...current, status: to };
      return true;
    },
    claim: async (_order, target, input) => {
      const existing = current.items.find((entry) => entry.id === target.id)?.fulfillment?.status;
      if (existing && existing !== "failed") return false;
      claims.push({ itemId: target.id, receiver: input.receiver, receiverId: input.receiverId });
      setFulfillment(target.id, "sending");
      return true;
    },
    finish: async (itemId, result) => { finished.push({ itemId, result }); setFulfillment(itemId, result.status); },
    updateOffer: async (itemId, offerId) => { current = { ...current, items: current.items.map((entry) => entry.id === itemId ? { ...entry, offerId } : entry) }; },
    alert: async (text) => { alerts.push(text); },
  };
  return { store, transitions, finished, claims, alerts, current: () => current };
}

type Handler = (action: FnShopAction, params: Record<string, string>) => Record<string, unknown> | Error;

function fakeFnShop(handler: Handler) {
  const calls: { action: FnShopAction; params: Record<string, string> }[] = [];
  const decisions: string[] = [];
  const caller: FnShopCaller = {
    config: fnShopConfigFromEnv({ VERCEL_ENV: "preview", FNSHOP_SIMULATE: "true", FNSHOP_CATEGORY: "vip" }),
    call: async (action, params): Promise<FnShopResponse> => {
      calls.push({ action, params });
      const body = handler(action, params);
      if (body instanceof Error) throw body;
      return { body, result: typeof body.result === "boolean" ? body.result : null, code: typeof body.code === "string" ? body.code : null, httpStatus: 200, callId: calls.length, simulated: true };
    },
    decide: async (_id, decision) => { decisions.push(decision); },
    usage: async () => ({ used: 0, today: 0 }),
  };
  return { caller, calls, decisions };
}

const sent = { result: true, code: "gift_sent_successfully", track_id: "trk", sender_id: "acc1", sender: "Sigfriedgift1", final_price: 800 };

function baseOrder(status: OrderStatus, items: DeliveryItem[]): DeliveryOrder {
  return { id: "order-1", status, displayName: "Jugador", platform: "psn", epicAccountId: "manual:abc", providerReceiverId: EPIC_ID, items };
}

describe("deliverOrder", () => {
  it("sends every item once, with the item id as FN Shop order_id, and closes the order", async () => {
    const { store, transitions, claims } = fakeStore(baseOrder("paid", [item("a"), item("b")]));
    const { caller, calls } = fakeFnShop(() => sent);
    const report = await deliverOrder({ orderId: "order-1", actorId: "admin", confirmPayment: false }, { store, fnshop: caller });

    expect(report.status).toBe("delivered");
    expect(transitions.map((entry) => entry.to)).toEqual(["ready_to_send", "validating_delivery", "delivering", "delivered"]);
    expect(calls.map((call) => call.params)).toEqual([
      { offerId: "offer-a", receiver: "psn:Jugador", receiver_id: EPIC_ID, category: "vip", order_id: "a" },
      { offerId: "offer-b", receiver: "psn:Jugador", receiver_id: EPIC_ID, category: "vip", order_id: "b" },
    ]);
    expect(claims).toHaveLength(2);
  });

  it("confirms the payment first only when asked to", async () => {
    const pending = fakeStore(baseOrder("receipt_submitted", [item("a")]));
    await expect(deliverOrder({ orderId: "order-1", actorId: "admin", confirmPayment: false }, { store: pending.store, fnshop: fakeFnShop(() => sent).caller })).rejects.toMatchObject({ httpStatus: 409 });

    const confirmed = fakeStore(baseOrder("receipt_submitted", [item("a")]));
    const report = await deliverOrder({ orderId: "order-1", actorId: "admin", confirmPayment: true }, { store: confirmed.store, fnshop: fakeFnShop(() => sent).caller });
    expect(report.status).toBe("delivered");
    expect(confirmed.transitions[0]).toMatchObject({ from: "receipt_submitted", to: "paid" });
  });

  it("never sends an item that is already sent, sending or waiting to be reconciled", async () => {
    const { store } = fakeStore(baseOrder("manual_review", [item("a", "sent"), item("b", "failed")]));
    const { caller, calls } = fakeFnShop(() => sent);
    const report = await deliverOrder({ orderId: "order-1", actorId: "admin", confirmPayment: false }, { store, fnshop: caller });
    expect(calls.map((call) => call.params.order_id)).toEqual(["b"]);
    expect(report.status).toBe("delivered");
  });

  it("leaves a doubtful send as unknown and moves the order to reconciling without retrying", async () => {
    const { store, finished } = fakeStore(baseOrder("paid", [item("a"), item("b")]));
    const { caller, calls } = fakeFnShop((_action, params) => params.order_id === "a" ? { result: false, code: "gift_outcome_unknown", outcome: "unknown" } : sent);
    const report = await deliverOrder({ orderId: "order-1", actorId: "admin", confirmPayment: false }, { store, fnshop: caller });
    expect(report.status).toBe("reconciling");
    expect(calls).toHaveLength(2);
    expect(finished.find((entry) => entry.itemId === "a")?.result.status).toBe("unknown");
  });

  it("treats a timeout or broken answer as unknown, not as a failure to retry", async () => {
    const { store, finished } = fakeStore(baseOrder("paid", [item("a")]));
    const { caller } = fakeFnShop(() => new FnShopTransportError("Tiempo de espera agotado.", 3));
    const report = await deliverOrder({ orderId: "order-1", actorId: "admin", confirmPayment: false }, { store, fnshop: caller });
    expect(report.status).toBe("reconciling");
    expect(finished[0].result).toMatchObject({ status: "unknown", code: "transport_error" });
  });

  it("keeps the order partial when one of three items is refused", async () => {
    const { store, transitions } = fakeStore(baseOrder("paid", [item("a"), item("b"), item("c")]));
    const { caller } = fakeFnShop((_action, params) => params.order_id === "b" ? { result: false, code: "receiver_owns_item_from_bundle" } : sent);
    const report = await deliverOrder({ orderId: "order-1", actorId: "admin", confirmPayment: false }, { store, fnshop: caller });
    expect(report.status).toBe("manual_review");
    expect(report.items.map((entry) => entry.result)).toEqual(["sent", "failed", "sent"]);
    expect(transitions.at(-1)?.metadata.reason).toContain("Objeto b");
    expect(transitions.at(-1)?.metadata).not.toHaveProperty("notes");
  });

  it("stops spending requests and alerts when the sender accounts have no V-Bucks", async () => {
    const { store, alerts } = fakeStore(baseOrder("paid", [item("a"), item("b")]));
    const { caller, calls } = fakeFnShop(() => ({ result: false, code: "not_eligible_to_receive_gift", reasons: { vbucks: ["acc1"] } }));
    const report = await deliverOrder({ orderId: "order-1", actorId: "admin", confirmPayment: false }, { store, fnshop: caller });
    expect(calls).toHaveLength(1);
    expect(report.items.map((entry) => entry.result)).toEqual(["failed", "not_attempted"]);
    expect(alerts[0]).toContain("paVos");
  });

  it("releases the item when the call never left (quota guard) so it can be retried", async () => {
    const { store, finished } = fakeStore(baseOrder("paid", [item("a")]));
    const { caller } = fakeFnShop(() => new FnShopUnavailableError("budget", "Se agotaron los requests del periodo."));
    const report = await deliverOrder({ orderId: "order-1", actorId: "admin", confirmPayment: false }, { store, fnshop: caller });
    expect(report.status).toBe("manual_review");
    expect(finished[0].result).toMatchObject({ status: "failed", code: "not_sent:budget" });
  });

  it("refuses an order that is already being sent", async () => {
    const { store } = fakeStore(baseOrder("delivering", [item("a", "sending")]));
    await expect(deliverOrder({ orderId: "order-1", actorId: "admin", confirmPayment: false }, { store, fnshop: fakeFnShop(() => sent).caller })).rejects.toMatchObject({ httpStatus: 409 });
  });
});

describe("reconcileOrder", () => {
  it("marks a doubtful item as sent when FN Shop's history has it", async () => {
    const { store, finished } = fakeStore(baseOrder("reconciling", [item("a", "sent"), item("b", "unknown")]));
    const { caller, calls } = fakeFnShop(() => ({ result: true, code: "order_history", orders: [{ id: "trk9", status: "completed", order_id: "b", sender: "acc1", price: 800 }] }));
    const report = await reconcileOrder({ orderId: "order-1", actorId: "admin" }, { store, fnshop: caller });
    expect(calls[0].params).toMatchObject({ order_id: "b", type: "api_gift", receiver: EPIC_ID });
    expect(finished[0].result).toMatchObject({ status: "sent", trackId: "trk9" });
    expect(report.status).toBe("delivered");
  });

  it("sends the order to manual review when the gift is not in the history", async () => {
    const { store } = fakeStore(baseOrder("reconciling", [item("a", "unknown")]));
    const { caller } = fakeFnShop(() => ({ result: true, code: "order_history", orders: [] }));
    const report = await reconcileOrder({ orderId: "order-1", actorId: "admin" }, { store, fnshop: caller });
    expect(report.status).toBe("manual_review");
  });
});

describe("preflightOrder", () => {
  it("refreshes an expired offerId with shop and checks again", async () => {
    const { store, current } = fakeStore(baseOrder("paid", [item("a")]));
    const responses: Record<string, unknown>[] = [
      { result: false, code: "catalog_out_of_date" },
      { result: true, code: "shop", items: [{ mainId: "main-a", offerId: "offer-new" }] },
      { result: true, code: "eligible_to_receive_gift", sender_id: "acc1", final_price: 800 },
    ];
    const { caller, calls } = fakeFnShop(() => responses.shift()!);
    const [result] = await preflightOrder("order-1", { store, fnshop: caller, actorId: "admin" });
    expect(calls.map((call) => call.action)).toEqual(["gift_check", "shop", "gift_check"]);
    expect(calls[2].params.offerId).toBe("offer-new");
    expect(result).toMatchObject({ eligible: true, offerRefreshed: true, senderId: "acc1" });
    expect(current().items[0].offerId).toBe("offer-new");
  });

  it("explains why an item cannot be sent yet", async () => {
    const { store } = fakeStore(baseOrder("paid", [item("a")]));
    const { caller } = fakeFnShop(() => ({ result: false, code: "not_eligible_to_receive_gift", reasons: { friendship_not_passed: ["acc1"] }, giftable_at: 1794700000 }));
    const [result] = await preflightOrder("order-1", { store, fnshop: caller, actorId: "admin" });
    expect(result).toMatchObject({ eligible: false, message: "La amistad todavía no cumple las 48 horas." });
  });
});

describe("gift_send results", () => {
  it("never reads an unexpected success code as a sent gift", () => {
    expect(interpretGiftSend({ result: true, code: "something_new" }).outcome).toBe("unknown");
    expect(interpretGiftSend({ result: false, code: "purchase_not_allowed" }).outcome).toBe("refused");
  });
});
