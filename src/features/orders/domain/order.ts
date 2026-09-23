export const ORDER_STATUSES = [
  "draft", "payment_pending", "awaiting_transfer", "receipt_submitted", "transfer_review",
  "information_required", "paid", "ready_to_send", "validating_delivery", "delivering",
  "reconciling", "delivered", "manual_review", "refund_pending", "refunded", "rejected", "expired", "canceled"
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = "mercado_pago" | "bank_transfer";

export type Order = Readonly<{
  id: string;
  publicToken: string;
  status: OrderStatus;
  customerEmail: string;
  epicAccountId: string;
  epicDisplayName: string;
  itemMainId: string;
  offerId: string;
  itemName: string;
  itemImageUrl: string | null;
  vbucksPrice: number;
  amountMxnCents: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
}>;

const transitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  draft: ["payment_pending", "awaiting_transfer", "canceled"],
  payment_pending: ["paid", "rejected", "expired", "canceled"],
  awaiting_transfer: ["receipt_submitted", "expired", "canceled"],
  receipt_submitted: ["transfer_review"],
  transfer_review: ["information_required", "paid", "rejected"],
  information_required: ["receipt_submitted", "rejected", "canceled"],
  paid: ["ready_to_send", "refund_pending", "manual_review"],
  ready_to_send: ["validating_delivery", "refund_pending", "manual_review"],
  validating_delivery: ["delivering", "manual_review", "refund_pending"],
  delivering: ["delivered", "reconciling", "manual_review"],
  reconciling: ["delivered", "manual_review"],
  manual_review: ["ready_to_send", "refund_pending", "canceled"],
  refund_pending: ["refunded", "manual_review"],
  delivered: [], refunded: [], rejected: [], expired: [], canceled: []
};

export class InvalidOrderTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`No se permite cambiar una orden de ${from} a ${to}.`);
    this.name = "InvalidOrderTransitionError";
  }
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!transitions[from].includes(to)) throw new InvalidOrderTransitionError(from, to);
}

export interface OrderRepository {
  create(input: Omit<Order, "id" | "publicToken" | "createdAt">): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByPublicToken(id: string, publicToken: string): Promise<Order | null>;
  transition(id: string, from: OrderStatus, to: OrderStatus, metadata?: Record<string, unknown>): Promise<boolean>;
}
