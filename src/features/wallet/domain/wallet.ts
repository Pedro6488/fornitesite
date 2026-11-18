import type { WalletBonus, WalletTier } from "./wallet-offers";
export type WalletRate = { region: "mx" | "us"; cents_per_100: number | null; active: boolean; cost_cents_per_100?: number | null; min_margin_bp?: number };
export type WalletTopup = { id: string; user_id: string; vbucks: number; region: "mx" | "us"; amount_cents: number; status: "awaiting_payment" | "submitted" | "approved" | "rejected" | "expired"; review_note: string | null; created_at: string; expires_at?: string; reference_code?: string; bonus_vbucks?: number; receiptUrl?: string | null };
/** Lo que el cliente escribe en el concepto del pago. La base la genera; el respaldo cubre filas antiguas. */
export function topupReference(topup: Pick<WalletTopup, "id" | "reference_code">) {
  return topup.reference_code ?? `RECARGA-${topup.id.slice(0, 8).toUpperCase()}`;
}
/** Una recarga sin comprobante vence a las 48 h aunque el cron todavía no la haya marcado. */
export function topupStatus(topup: Pick<WalletTopup, "status" | "expires_at">, now = Date.now()): WalletTopup["status"] {
  return topup.status === "awaiting_payment" && topup.expires_at && Date.parse(topup.expires_at) <= now ? "expired" : topup.status;
}
export type WalletMovement = { id: string; delta: number; kind: "topup" | "purchase" | "refund" | "adjustment" | "bonus"; order_id: string | null; reason?: string | null; created_at: string };
export type WalletData = { balance: number; frozen: boolean; paused?: boolean; tiers?: WalletTier[]; bonuses?: WalletBonus[]; rates: WalletRate[]; topups: WalletTopup[]; movements: WalletMovement[]; automaticDelivery: boolean; supportWhatsapp?: string };
export const movementLabels: Record<WalletMovement["kind"], string> = { topup: "Recarga acreditada", purchase: "Compra de objetos", refund: "Pavos devueltos", adjustment: "Ajuste de saldo", bonus: "Pavos de regalo" };
export function topupPrice(vbucks: number, rate: WalletRate | undefined): number | null {
  if (!rate?.active || !rate.cents_per_100 || !Number.isInteger(vbucks) || vbucks < 100 || vbucks > 50000 || vbucks % 100) return null;
  return vbucks / 100 * rate.cents_per_100;
}
/** Comisión de PayPal por cobro recibido (tarifa estándar internacional). Ajustar si cambia el contrato. */
export const PAYPAL_PERCENT_BP = 540;
export const PAYPAL_FIXED_CENTS = 30;
export function paypalNetCents(grossCents: number) {
  return Math.max(0, grossCents - Math.round(grossCents * PAYPAL_PERCENT_BP / 10_000) - PAYPAL_FIXED_CENTS);
}

/**
 * Compara el pago habitual de un pedido con lo que cuestan sus pavos a la tarifa de recarga actual.
 * `savingsCents` > 0: conviene pagar con pavos; < 0: el pago habitual sale más barato.
 */
export function compareWalletPrice(regularCents: number | null | undefined, vbucks: number, rate: WalletRate | undefined) {
  if (!regularCents || regularCents <= 0 || !rate?.cents_per_100 || vbucks <= 0) return null;
  const equivalentCents = Math.round(vbucks / 100 * rate.cents_per_100);
  return { regularCents, equivalentCents, savingsCents: regularCents - equivalentCents };
}
export function walletMoney(cents: number, region: "mx" | "us") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: region === "mx" ? "MXN" : "USD" }).format(cents / 100) + (region === "mx" ? " MXN" : " USD");
}
export const topupLabels: Record<WalletTopup["status"], string> = { awaiting_payment: "Pendiente de pago", submitted: "Comprobante en revisión", approved: "Pavos acreditados", rejected: "Recarga rechazada", expired: "Recarga vencida" };
