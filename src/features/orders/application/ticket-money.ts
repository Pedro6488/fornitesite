export function ticketMoney(currency: string | null | undefined, mxn: number, usd?: number | null, quantity = 1): string {
  const cents = currency === "USD" ? usd : currency === "MXN" ? mxn : null;
  if (cents == null || !Number.isFinite(cents) || cents <= 0) return "";
  return `${(cents * quantity / 100).toLocaleString("es-MX", { style: "currency", currency: currency! })} ${currency}`;
}
