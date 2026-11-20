import { topupReference, walletMoney, type WalletTopup } from "./wallet";

/**
 * Avisos de Telegram para el equipo. Cada paso en que el cliente queda esperando a la tienda
 * debe avisar, igual que el comprobante de un pedido habitual (`telegram.order.receipt_submitted`).
 */
export function topupSubmittedAlert(topup: Pick<WalletTopup, "id" | "reference_code" | "vbucks" | "bonus_vbucks" | "amount_cents" | "region">, customer: string | null | undefined) {
  const bonus = topup.bonus_vbucks ?? 0;
  return [
    `🧾 Recarga de pavos por liberar · ${topupReference(topup)}`,
    "",
    `Pavos: ${topup.vbucks.toLocaleString("es-MX")}${bonus ? ` + ${bonus.toLocaleString("es-MX")} de regalo` : ""}`,
    `Monto: ${walletMoney(topup.amount_cents, topup.region)}`,
    `Cliente: ${customer || "sin correo"}`,
    "",
    `Busca la referencia ${topupReference(topup)} por ese monto en el banco o en PayPal y acredita en Clientes con pavos. No apruebes solo por la imagen.`,
  ].join("\n");
}
