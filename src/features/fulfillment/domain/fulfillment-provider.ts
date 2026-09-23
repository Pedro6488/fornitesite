export type GiftInput = Readonly<{ offerId: string; receiver: string; receiverId: string; orderId: string; category?: string }>;
export interface FulfillmentProvider {
  check(input: Omit<GiftInput, "orderId">): Promise<{ available: boolean; reason?: string }>;
  send(input: GiftInput): Promise<{ externalId: string; senderId?: string }>;
  findByOrderId(orderId: string): Promise<{ delivered: boolean; externalId?: string }>;
}
