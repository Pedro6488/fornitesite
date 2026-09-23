import type { FulfillmentProvider, GiftInput } from "../domain/fulfillment-provider";

export class FnShopFulfillmentProvider implements FulfillmentProvider {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}
  async check(input: Omit<GiftInput, "orderId">) {
    const response = await this.call("gift_check", input);
    return { available: response.result === true, reason: typeof response.description === "string" ? response.description : undefined };
  }
  async send(input: GiftInput) {
    const response = await this.call("gift_send", input);
    if (response.result !== true) throw new Error(String(response.description ?? "El proveedor rechazó el regalo."));
    return { externalId: String(response.id ?? response.order_id ?? input.orderId), senderId: typeof response.sender === "string" ? response.sender : undefined };
  }
  async findByOrderId(orderId: string) {
    const response = await this.call("order_history", { order_id: orderId, limit: "1" });
    const orders = Array.isArray(response.orders) ? response.orders as Array<Record<string, unknown>> : [];
    const found = orders[0]; return { delivered: found?.status === "completed", externalId: found ? String(found.id ?? "") : undefined };
  }
  private async call(action: string, input: Record<string, unknown>) {
    const response = await fetch(`${this.baseUrl}/${action}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": this.apiKey }, body: JSON.stringify(input), cache: "no-store" });
    if (!response.ok) throw new Error(`FN Shop ${action} respondió ${response.status}.`);
    return response.json() as Promise<Record<string, unknown>>;
  }
}
