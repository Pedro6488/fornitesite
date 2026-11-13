import type { OrderStatus } from "@/features/orders/domain/order";
import type { IdentityValidationStatus } from "@/features/commerce/application/identity-review-state";
import { RECEIPT_REVIEW_STATUSES, SALE_STATUSES, statusesOf } from "./order-queues";

/**
 * Cálculo del tablero de Inicio. Es una función pura: recibe filas de nuestra
 * propia base y devuelve los números que se dibujan. No llama a ningún servicio.
 */

/** Pedido tal como lo necesita el tablero. `items` y `receiptAt` solo vienen en los pedidos del periodo consultado. */
export type OverviewOrder = {
  id: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string | null;
  paidAt: string | null;
  deliveredAt: string | null;
  amountMxnCents: number;
  recipientId: string;
  receiptAt?: string | null;
  items?: readonly { mainId: string; name: string; imageUrl: string | null; quantity: number; unitAmountMxnCents: number }[];
};

export type OverviewValidation = { recipientId: string; status: IdentityValidationStatus; giftableAt: string | null };

/** `previous` es el mismo indicador en el periodo anterior de igual duración. */
export type Stat = { value: number | null; previous: number | null };
export type QueueStat = { count: number; oldestAt: string | null };

export type OperationsOverview = {
  generatedAt: string;
  range: { days: number; from: string; to: string };
  queues: { receipts: QueueStat; awaitingCustomer: QueueStat; deliver: QueueStat; problem: QueueStat; recipients: QueueStat };
  kpis: {
    salesMxnCents: Stat;
    paidOrders: Stat;
    averageTicketMxnCents: Stat;
    completionRate: Stat;
    paymentReviewMinutes: Stat;
    deliveryMinutes: Stat;
  };
  daily: { day: string; salesMxnCents: number; paidOrders: number; createdOrders: number }[];
  hourly: { hour: number; orders: number }[];
  funnel: { created: number; withReceipt: number; paid: number; delivered: number };
  outcomes: { delivered: number; open: number; expired: number; canceled: number; rejected: number; refunded: number };
  topItems: { mainId: string; name: string; imageUrl: string | null; units: number; salesMxnCents: number }[];
  customers: { newRecipients: number; returningRecipients: number };
  recipients: { ready: number; waiting: number; pendingFriendship: number; manualReview: number; blocked: number; releasingIn24h: number; waitExpired: number };
};

export const OVERVIEW_RANGES = [7, 30, 90] as const;
export type OverviewRangeDays = (typeof OVERVIEW_RANGES)[number];

/** Ciudad de México no cambia de horario desde 2022: siempre UTC−6. */
const MX_OFFSET_MS = 6 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

export function mexicoDayKey(instant: number): string {
  return new Date(instant - MX_OFFSET_MS).toISOString().slice(0, 10);
}

function mexicoHour(instant: number): number {
  return new Date(instant - MX_OFFSET_MS).getUTCHours();
}

/** Inicio (medianoche de México) del día que contiene `instant`. */
function mexicoDayStart(instant: number): number {
  return Date.parse(`${mexicoDayKey(instant)}T00:00:00.000Z`) + MX_OFFSET_MS;
}

/** Primer instante que debe cubrir la consulta de pedidos: el periodo pedido más el anterior, para comparar. */
export function overviewWindowStart(now: Date, days: number): Date {
  return new Date(mexicoDayStart(now.getTime()) - (2 * days - 1) * DAY_MS);
}

function isSale(order: OverviewOrder): boolean {
  return SALE_STATUSES.includes(order.status);
}

function saleInstant(order: OverviewOrder): number {
  return Date.parse(order.paidAt ?? order.createdAt);
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function queueStat(orders: readonly OverviewOrder[], statuses: readonly OrderStatus[]): QueueStat {
  const waiting = orders.filter((order) => statuses.includes(order.status));
  const oldest = waiting.map((order) => order.updatedAt ?? order.createdAt).sort()[0] ?? null;
  return { count: waiting.length, oldestAt: oldest };
}

type PeriodFigures = {
  salesMxnCents: number;
  paidOrders: number;
  averageTicketMxnCents: number | null;
  completionRate: number | null;
  paymentReviewMinutes: number | null;
  deliveryMinutes: number | null;
};

function periodFigures(orders: readonly OverviewOrder[], from: number, to: number): PeriodFigures {
  const inside = (instant: number) => instant >= from && instant < to;
  const sales = orders.filter((order) => isSale(order) && inside(saleInstant(order)));
  const salesMxnCents = sales.reduce((total, order) => total + order.amountMxnCents, 0);
  const closed = orders.filter((order) => inside(Date.parse(order.createdAt)) && statusesOf("closed").includes(order.status));
  const reviewMinutes = sales.flatMap((order) => order.paidAt && order.receiptAt
    ? [Math.max(0, Date.parse(order.paidAt) - Date.parse(order.receiptAt)) / 60_000]
    : []);
  const deliveryMinutes = orders.flatMap((order) => order.status === "delivered" && order.paidAt && order.deliveredAt && inside(Date.parse(order.deliveredAt))
    ? [Math.max(0, Date.parse(order.deliveredAt) - Date.parse(order.paidAt)) / 60_000]
    : []);
  return {
    salesMxnCents,
    paidOrders: sales.length,
    averageTicketMxnCents: sales.length ? Math.round(salesMxnCents / sales.length) : null,
    completionRate: closed.length ? (closed.filter((order) => order.status === "delivered").length / closed.length) * 100 : null,
    paymentReviewMinutes: median(reviewMinutes),
    deliveryMinutes: median(deliveryMinutes),
  };
}

const RECIPIENT_STATUS_RANK: Record<IdentityValidationStatus, number> = { pending_friendship: 1, manual_review: 2, waiting: 3, ready: 4, blocked: 5 };

/** Un destinatario puede tener una validación por sesión; cuenta una sola vez, con su decisión más fuerte. */
function uniqueRecipients(validations: readonly OverviewValidation[]): OverviewValidation[] {
  const strongest = new Map<string, OverviewValidation>();
  for (const validation of validations) {
    const current = strongest.get(validation.recipientId);
    if (!current || RECIPIENT_STATUS_RANK[validation.status] > RECIPIENT_STATUS_RANK[current.status]) strongest.set(validation.recipientId, validation);
  }
  return [...strongest.values()];
}

export function buildOperationsOverview(input: {
  orders: readonly OverviewOrder[];
  validations: readonly OverviewValidation[];
  now: Date;
  days: number;
}): OperationsOverview {
  const { orders, now, days } = input;
  const nowMs = now.getTime();
  const to = mexicoDayStart(nowMs) + DAY_MS;
  const from = to - days * DAY_MS;
  const previousFrom = from - days * DAY_MS;
  const inRange = (instant: number) => instant >= from && instant < to;

  const current = periodFigures(orders, from, to);
  const previous = periodFigures(orders, previousFrom, from);
  const stat = (key: keyof PeriodFigures): Stat => ({ value: current[key], previous: previous[key] });

  const daily = Array.from({ length: days }, (_, index) => ({ day: mexicoDayKey(from + index * DAY_MS), salesMxnCents: 0, paidOrders: 0, createdOrders: 0 }));
  const dayIndex = new Map(daily.map((entry, index) => [entry.day, index]));
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }));
  const funnel = { created: 0, withReceipt: 0, paid: 0, delivered: 0 };
  const outcomes = { delivered: 0, open: 0, expired: 0, canceled: 0, rejected: 0, refunded: 0 };
  const items = new Map<string, OperationsOverview["topItems"][number]>();
  const buyers = new Set<string>();

  for (const order of orders) {
    const createdAt = Date.parse(order.createdAt);
    if (inRange(createdAt) && order.status !== "draft") {
      const day = dayIndex.get(mexicoDayKey(createdAt));
      if (day !== undefined) daily[day].createdOrders += 1;
      hourly[mexicoHour(createdAt)].orders += 1;
      const paid = Boolean(order.paidAt) || isSale(order);
      funnel.created += 1;
      if (paid || order.receiptAt || RECEIPT_REVIEW_STATUSES.includes(order.status)) funnel.withReceipt += 1;
      if (paid) funnel.paid += 1;
      if (order.status === "delivered") funnel.delivered += 1;
      if (order.status === "delivered" || order.status === "expired" || order.status === "canceled" || order.status === "rejected" || order.status === "refunded") outcomes[order.status] += 1;
      else outcomes.open += 1;
    }
    if (isSale(order) && inRange(saleInstant(order))) {
      const day = dayIndex.get(mexicoDayKey(saleInstant(order)));
      if (day !== undefined) {
        daily[day].salesMxnCents += order.amountMxnCents;
        daily[day].paidOrders += 1;
      }
      buyers.add(order.recipientId);
      for (const item of order.items ?? []) {
        const entry = items.get(item.mainId) ?? { mainId: item.mainId, name: item.name, imageUrl: item.imageUrl, units: 0, salesMxnCents: 0 };
        entry.units += item.quantity;
        entry.salesMxnCents += item.unitAmountMxnCents * item.quantity;
        items.set(item.mainId, entry);
      }
    }
  }

  const earlierBuyers = new Set(orders.filter((order) => isSale(order) && saleInstant(order) < from).map((order) => order.recipientId));
  const returningRecipients = [...buyers].filter((recipient) => earlierBuyers.has(recipient)).length;

  const recipients = uniqueRecipients(input.validations);
  const countRecipients = (status: IdentityValidationStatus) => recipients.filter((entry) => entry.status === status).length;
  const waiting = recipients.filter((entry) => entry.status === "waiting");
  const waitExpired = waiting.filter((entry) => entry.giftableAt && Date.parse(entry.giftableAt) <= nowMs).length;

  return {
    generatedAt: now.toISOString(),
    range: { days, from: mexicoDayKey(from), to: mexicoDayKey(to - DAY_MS) },
    queues: {
      receipts: queueStat(orders, RECEIPT_REVIEW_STATUSES),
      awaitingCustomer: queueStat(orders, ["awaiting_transfer", "information_required", "payment_pending"]),
      deliver: queueStat(orders, statusesOf("deliver")),
      problem: queueStat(orders, statusesOf("problem")),
      recipients: { count: countRecipients("manual_review") + countRecipients("pending_friendship") + waitExpired, oldestAt: null },
    },
    kpis: {
      salesMxnCents: stat("salesMxnCents"),
      paidOrders: stat("paidOrders"),
      averageTicketMxnCents: stat("averageTicketMxnCents"),
      completionRate: stat("completionRate"),
      paymentReviewMinutes: stat("paymentReviewMinutes"),
      deliveryMinutes: stat("deliveryMinutes"),
    },
    daily,
    hourly,
    funnel,
    outcomes,
    topItems: [...items.values()].sort((left, right) => right.units - left.units || right.salesMxnCents - left.salesMxnCents).slice(0, 8),
    customers: { newRecipients: buyers.size - returningRecipients, returningRecipients },
    recipients: {
      ready: countRecipients("ready"),
      waiting: waiting.length,
      pendingFriendship: countRecipients("pending_friendship"),
      manualReview: countRecipients("manual_review"),
      blocked: countRecipients("blocked"),
      releasingIn24h: waiting.filter((entry) => entry.giftableAt && Date.parse(entry.giftableAt) > nowMs && Date.parse(entry.giftableAt) <= nowMs + DAY_MS).length,
      waitExpired,
    },
  };
}
