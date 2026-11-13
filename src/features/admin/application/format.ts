/** Formatos de la consola. Texto plano, en español de México. */

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

export type OrderMoney = { currency?: "MXN" | "USD" | null; amount_mxn_cents: number; amount_usd_cents?: number | null };

/**
 * Importe de un pedido en la moneda en que se cobró: los pedidos en dólares muestran
 * el monto guardado en USD, nunca una conversión. Sin monto en USD, cae a pesos.
 */
export function formatOrderMoney(order: OrderMoney, quantity = 1): string {
  if (order.currency === "USD" && order.amount_usd_cents && order.amount_usd_cents > 0) {
    const cents = order.amount_usd_cents * quantity;
    return `${(cents / 100).toLocaleString("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 })} USD`;
  }
  return formatMoney(order.amount_mxn_cents * quantity);
}

/** Importe de un objeto del pedido, en la moneda del pedido. */
export function formatItemMoney(currency: OrderMoney["currency"], item: { unit_amount_mxn_cents: number; unit_amount_usd_cents?: number | null; quantity: number }): string {
  return formatOrderMoney({ currency, amount_mxn_cents: item.unit_amount_mxn_cents, amount_usd_cents: item.unit_amount_usd_cents }, item.quantity);
}

/** $12.9 K, $1.2 M: para ejes y cifras grandes. */
export function formatCompactMoney(cents: number): string {
  const pesos = cents / 100;
  if (pesos >= 1_000_000) return `$${(pesos / 1_000_000).toLocaleString("es-MX", { maximumFractionDigits: 1 })} M`;
  if (pesos >= 10_000) return `$${(pesos / 1_000).toLocaleString("es-MX", { maximumFractionDigits: 1 })} K`;
  return `$${Math.round(pesos).toLocaleString("es-MX")}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${Math.round(minutes - hours * 60)} min`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours - days * 24} h`;
}

/** «hace 3 h»: cuánto lleva esperando algo. */
export function formatAge(since: string, now: number = Date.now()): string {
  const minutes = Math.max(0, (now - Date.parse(since)) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

/** «12 nov» a partir de una clave de día `2026-11-12`. */
export function formatDayKey(day: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("es-MX", { ...options, timeZone: "UTC" });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

export function shortOrderId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}
