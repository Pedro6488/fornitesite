import { describe, expect, it } from "vitest";
import { buildOperationsOverview, mexicoDayKey, overviewWindowStart, type OverviewOrder } from "./operations-overview";

// Jueves 12 de noviembre de 2026, 13:00 en Ciudad de México.
const now = new Date("2026-11-12T19:00:00.000Z");

let sequence = 0;
function order(overrides: Partial<OverviewOrder>): OverviewOrder {
  sequence += 1;
  return {
    id: `order-${sequence}`, status: "delivered", createdAt: "2026-11-12T15:00:00.000Z", updatedAt: null,
    paidAt: null, deliveredAt: null, amountMxnCents: 10_000, recipientId: `recipient-${sequence}`, ...overrides,
  };
}

function overview(orders: OverviewOrder[], days = 7) {
  return buildOperationsOverview({ orders, validations: [], now, days });
}

describe("mexico day", () => {
  it("keeps late-night orders on the Mexican calendar day", () => {
    expect(mexicoDayKey(Date.parse("2026-11-13T04:30:00.000Z"))).toBe("2026-11-12");
    expect(mexicoDayKey(Date.parse("2026-11-13T06:00:00.000Z"))).toBe("2026-11-13");
  });

  it("starts the query window at the first day of the previous period", () => {
    expect(overviewWindowStart(now, 7).toISOString()).toBe("2026-10-30T06:00:00.000Z");
  });
});

describe("operations overview", () => {
  it("counts a sale on the day it was paid and compares with the previous period", () => {
    const result = overview([
      order({ paidAt: "2026-11-12T16:00:00.000Z", amountMxnCents: 30_000 }),
      order({ status: "paid", createdAt: "2026-11-10T03:00:00.000Z", paidAt: "2026-11-10T05:00:00.000Z", amountMxnCents: 10_000 }),
      order({ createdAt: "2026-11-02T15:00:00.000Z", paidAt: "2026-11-02T16:00:00.000Z", amountMxnCents: 5_000 }),
      order({ status: "expired", amountMxnCents: 99_000 }),
    ]);

    expect(result.range).toEqual({ days: 7, from: "2026-11-06", to: "2026-11-12" });
    expect(result.kpis.salesMxnCents).toEqual({ value: 40_000, previous: 5_000 });
    expect(result.kpis.paidOrders).toEqual({ value: 2, previous: 1 });
    expect(result.kpis.averageTicketMxnCents.value).toBe(20_000);
    expect(result.daily).toHaveLength(7);
    expect(result.daily.at(-1)).toEqual({ day: "2026-11-12", salesMxnCents: 30_000, paidOrders: 1, createdOrders: 2 });
    expect(result.daily.find((entry) => entry.day === "2026-11-09")).toMatchObject({ salesMxnCents: 10_000, paidOrders: 1, createdOrders: 1 });
  });

  it("builds the funnel and outcomes from orders created in the period", () => {
    const result = overview([
      order({ paidAt: "2026-11-12T16:00:00.000Z" }),
      order({ status: "paid", paidAt: "2026-11-12T16:00:00.000Z" }),
      order({ status: "receipt_submitted" }),
      order({ status: "awaiting_transfer" }),
      order({ status: "expired" }),
      order({ status: "draft" }),
    ]);

    expect(result.funnel).toEqual({ created: 5, withReceipt: 3, paid: 2, delivered: 1 });
    expect(result.outcomes).toEqual({ delivered: 1, open: 3, expired: 1, canceled: 0, rejected: 0, refunded: 0 });
    expect(result.kpis.completionRate.value).toBe(50);
    expect(result.hourly[9].orders).toBe(5);
  });

  it("measures how long the team takes to review a receipt and to deliver", () => {
    const result = overview([
      order({ receiptAt: "2026-11-12T15:10:00.000Z", paidAt: "2026-11-12T15:40:00.000Z", deliveredAt: "2026-11-12T17:40:00.000Z" }),
      order({ receiptAt: "2026-11-12T15:00:00.000Z", paidAt: "2026-11-12T15:10:00.000Z", deliveredAt: "2026-11-12T15:40:00.000Z" }),
      order({ paidAt: "2026-11-12T15:10:00.000Z", deliveredAt: "2026-11-12T16:10:00.000Z" }),
    ]);

    expect(result.kpis.paymentReviewMinutes.value).toBe(20);
    expect(result.kpis.deliveryMinutes.value).toBe(60);
    expect(result.kpis.deliveryMinutes.previous).toBeNull();
  });

  it("ranks the best-selling items by units", () => {
    const skin = { mainId: "skin", name: "Skin", imageUrl: null, quantity: 1, unitAmountMxnCents: 20_000 };
    const emote = { mainId: "emote", name: "Gesto", imageUrl: null, quantity: 1, unitAmountMxnCents: 5_000 };
    const result = overview([
      order({ paidAt: "2026-11-12T16:00:00.000Z", items: [skin, emote] }),
      order({ paidAt: "2026-11-11T16:00:00.000Z", items: [emote] }),
      order({ status: "canceled", items: [skin, skin] }),
    ]);

    expect(result.topItems).toEqual([
      { mainId: "emote", name: "Gesto", imageUrl: null, units: 2, salesMxnCents: 10_000 },
      { mainId: "skin", name: "Skin", imageUrl: null, units: 1, salesMxnCents: 20_000 },
    ]);
  });

  it("separates new recipients from returning ones", () => {
    const result = overview([
      order({ recipientId: "ana", paidAt: "2026-11-12T16:00:00.000Z" }),
      order({ recipientId: "ana", createdAt: "2026-09-01T16:00:00.000Z", paidAt: "2026-09-01T16:00:00.000Z" }),
      order({ recipientId: "luis", paidAt: "2026-11-11T16:00:00.000Z" }),
      order({ recipientId: "luis", paidAt: "2026-11-12T16:00:00.000Z" }),
    ]);

    expect(result.customers).toEqual({ newRecipients: 1, returningRecipients: 1 });
  });

  it("reports open work regardless of how old the order is", () => {
    const result = overview([
      order({ status: "receipt_submitted", createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T11:00:00.000Z" }),
      order({ status: "transfer_review", updatedAt: "2026-11-12T16:00:00.000Z" }),
      order({ status: "delivering" }),
      order({ status: "manual_review" }),
      order({ status: "awaiting_transfer" }),
    ]);

    expect(result.queues.receipts).toEqual({ count: 2, oldestAt: "2026-08-01T11:00:00.000Z" });
    expect(result.queues.deliver.count).toBe(1);
    expect(result.queues.problem.count).toBe(1);
    expect(result.queues.awaitingCustomer.count).toBe(1);
  });

  it("counts each recipient once with its strongest decision", () => {
    const result = buildOperationsOverview({
      orders: [], now, days: 7,
      validations: [
        { recipientId: "ana", status: "manual_review", giftableAt: null },
        { recipientId: "ana", status: "ready", giftableAt: null },
        { recipientId: "luis", status: "waiting", giftableAt: "2026-11-13T02:00:00.000Z" },
        { recipientId: "eva", status: "waiting", giftableAt: "2026-11-12T10:00:00.000Z" },
        { recipientId: "sol", status: "waiting", giftableAt: "2026-11-15T10:00:00.000Z" },
        { recipientId: "max", status: "manual_review", giftableAt: null },
        { recipientId: "kai", status: "blocked", giftableAt: null },
      ],
    });

    expect(result.recipients).toEqual({ ready: 1, waiting: 3, pendingFriendship: 0, manualReview: 1, blocked: 1, releasingIn24h: 1, waitExpired: 1 });
    expect(result.queues.recipients.count).toBe(2);
  });
});
