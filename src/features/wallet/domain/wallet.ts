export type WalletRate = { region: "mx" | "us"; cents_per_100: number | null; active: boolean };
export type WalletTopup = { id: string; user_id: string; vbucks: number; region: "mx" | "us"; amount_cents: number; status: "awaiting_payment" | "submitted" | "approved" | "rejected" | "expired"; review_note: string | null; created_at: string; expires_at?: string; receiptUrl?: string | null };
/** Una recarga sin comprobante vence a las 48 h aunque el cron todavía no la haya marcado. */
export function topupStatus(topup: Pick<WalletTopup, "status" | "expires_at">, now = Date.now()): WalletTopup["status"] {
  return topup.status === "awaiting_payment" && topup.expires_at && Date.parse(topup.expires_at) <= now ? "expired" : topup.status;
}
export type WalletMovement = { id: string; delta: number; kind: "topup" | "purchase" | "refund"; order_id: string | null; created_at: string };
export type WalletData = { balance: number; rates: WalletRate[]; topups: WalletTopup[]; movements: WalletMovement[]; automaticDelivery: boolean };
export function topupPrice(vbucks: number, rate: WalletRate | undefined): number | null {
  if (!rate?.active || !rate.cents_per_100 || !Number.isInteger(vbucks) || vbucks < 100 || vbucks > 50000 || vbucks % 100) return null;
  return vbucks / 100 * rate.cents_per_100;
}
export function walletMoney(cents: number, region: "mx" | "us") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: region === "mx" ? "MXN" : "USD" }).format(cents / 100) + (region === "mx" ? " MXN" : " USD");
}
export const topupLabels: Record<WalletTopup["status"], string> = { awaiting_payment: "Pendiente de pago", submitted: "Comprobante en revisión", approved: "Pavos acreditados", rejected: "Recarga rechazada", expired: "Recarga vencida" };
