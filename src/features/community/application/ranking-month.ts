export function getRankingMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")!.value);
  const month = Number(parts.find((part) => part.type === "month")!.value);
  // Mexico City uses UTC-6 throughout the year.
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 6)).toISOString(),
    end: new Date(Date.UTC(year, month, 1, 6)).toISOString(),
    label: now.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", month: "long", year: "numeric" }),
  };
}
