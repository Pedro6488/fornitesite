import type { Order } from "@/features/orders/domain/order";
import type { PaymentProvider } from "../domain/payment-provider";

export class MercadoPagoProvider implements PaymentProvider {
  constructor(private readonly accessToken: string, private readonly appUrl: string) {}

  async createCheckout(order: Order) {
    const response = await this.request("/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Idempotency-Key": `checkout-${order.id}` },
      body: JSON.stringify({
        items: [{ id: order.itemMainId, title: order.itemName, quantity: 1, currency_id: "MXN", unit_price: order.amountMxnCents / 100 }],
        payer: { email: order.customerEmail }, external_reference: order.id,
        notification_url: `${this.appUrl}/api/webhooks/mercado-pago`,
        back_urls: { success: `${this.appUrl}/pedidos/${order.id}?access=${order.publicToken}`, pending: `${this.appUrl}/pedidos/${order.id}?access=${order.publicToken}`, failure: `${this.appUrl}/pedidos/${order.id}?access=${order.publicToken}` },
        auto_return: "approved", expires: true,
        expiration_date_to: new Date(Date.now() + 30 * 60_000).toISOString()
      })
    }) as { id: string; init_point: string };
    return { externalId: response.id, checkoutUrl: response.init_point };
  }

  async getPayment(externalId: string) {
    const payment = await this.request(`/v1/payments/${encodeURIComponent(externalId)}`) as { status: string; external_reference: string };
    const status = payment.status === "approved" ? "approved" : payment.status === "refunded" ? "refunded" : ["rejected", "cancelled"].includes(payment.status) ? "rejected" : "pending";
    return { status, externalReference: payment.external_reference } as const;
  }

  async refund(externalId: string, amountCents?: number) {
    await this.request(`/v1/payments/${encodeURIComponent(externalId)}/refunds`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Idempotency-Key": `refund-${externalId}-${amountCents ?? "full"}` },
      body: amountCents ? JSON.stringify({ amount: amountCents / 100 }) : "{}"
    });
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`https://api.mercadopago.com${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${this.accessToken}` }, cache: "no-store" });
    if (!response.ok) throw new Error(`Mercado Pago respondió ${response.status}.`);
    return response.json();
  }
}
