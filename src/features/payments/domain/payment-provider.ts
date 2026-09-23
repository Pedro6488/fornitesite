import type { Order } from "@/features/orders/domain/order";

export interface PaymentProvider {
  createCheckout(order: Order): Promise<{ externalId: string; checkoutUrl: string }>;
  getPayment(externalId: string): Promise<{ status: "approved" | "pending" | "rejected" | "refunded"; externalReference: string }>;
  refund(externalId: string, amountCents?: number): Promise<void>;
}
