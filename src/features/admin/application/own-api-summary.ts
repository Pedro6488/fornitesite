/**
 * Resumen de nuestra API (epic-gifting) a partir de `provider_api_calls`.
 * Función pura: la ruta lee las filas y esto decide qué significa cada una.
 */

export type OwnCallRow = {
  created_at: string;
  action: string;
  code: string | null;
  result: boolean | null;
  decision: string | null;
  duration_ms: number | null;
  error: string | null;
  http_status: number | null;
};

export type FnShopCallRow = { created_at: string; action: string };

/**
 * - `answered`: nuestra API contestó y su respuesta fue la que usó la tienda.
 * - `fallback`: contestó «no puedo» o no contestó, y la tienda le preguntó a FN Shop.
 * - `failed`: no contestó y no había respaldo (un envío o una conciliación sin respuesta).
 * - `shadow`: solo se llamó para comparar; decidió FN Shop.
 */
export type OwnOutcome = "answered" | "fallback" | "failed" | "shadow";

export function classifyOwnCall(row: OwnCallRow): OwnOutcome {
  if (row.decision === "shadow") return "shadow";
  if (row.decision === "fallback_to_fnshop") return "fallback";
  if (row.error || (row.http_status ?? 0) >= 500 || row.code === null) return "failed";
  return "answered";
}

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" });
/** Día en hora de México, `YYYY-MM-DD`. */
export function mexicoDay(value: string | Date): string {
  return DAY.format(typeof value === "string" ? new Date(value) : value);
}

function percentile(sorted: readonly number[], fraction: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)] ?? null;
}

export type OwnApiSummary = {
  totals: { calls: number; answered: number; fallback: number; failed: number; shadow: number; today: number; firstCallAt: string | null; lastCallAt: string | null };
  /** Llamadas por día desde la primera llamada del periodo (no entre los 30 días completos). */
  pacePerDay: number;
  /** De lo que la tienda preguntó (sin contar comparaciones), qué parte contestó nuestra API. */
  share: { own: number; fnshop: number; ownPercent: number | null };
  /** Contestadas entre las que debían contestarse (sin comparaciones). */
  answerRate: number | null;
  byDay: { day: string; own: number; fnshop: number; problems: number }[];
  byAction: { action: string; calls: number; answered: number; fallback: number; failed: number; shadow: number; p50: number | null; p95: number | null }[];
  codes: { code: string; calls: number }[];
};

export function summarizeOwnApi(input: { own: readonly OwnCallRow[]; fnshop: readonly FnShopCallRow[]; now: Date; days: number }): OwnApiSummary {
  const today = mexicoDay(input.now);
  const days: string[] = [];
  for (let offset = input.days - 1; offset >= 0; offset -= 1) days.push(mexicoDay(new Date(input.now.getTime() - offset * 86_400_000)));
  const byDay = new Map(days.map((day) => [day, { day, own: 0, fnshop: 0, problems: 0 }]));

  const totals = { calls: 0, answered: 0, fallback: 0, failed: 0, shadow: 0, today: 0, firstCallAt: null as string | null, lastCallAt: null as string | null };
  const actions = new Map<string, { action: string; calls: number; answered: number; fallback: number; failed: number; shadow: number; durations: number[] }>();
  const codes = new Map<string, number>();

  for (const row of input.own) {
    const outcome = classifyOwnCall(row);
    const day = mexicoDay(row.created_at);
    totals.calls += 1;
    totals[outcome] += 1;
    if (day === today) totals.today += 1;
    if (!totals.lastCallAt || row.created_at > totals.lastCallAt) totals.lastCallAt = row.created_at;
    if (!totals.firstCallAt || row.created_at < totals.firstCallAt) totals.firstCallAt = row.created_at;
    const bucket = byDay.get(day);
    if (bucket && outcome === "answered") bucket.own += 1;
    if (bucket && (outcome === "fallback" || outcome === "failed")) bucket.problems += 1;
    const action = actions.get(row.action) ?? { action: row.action, calls: 0, answered: 0, fallback: 0, failed: 0, shadow: 0, durations: [] };
    action.calls += 1;
    action[outcome] += 1;
    if (row.duration_ms !== null) action.durations.push(row.duration_ms);
    actions.set(row.action, action);
    const code = row.code ?? (row.error ? "sin respuesta" : `HTTP ${row.http_status ?? "—"}`);
    codes.set(code, (codes.get(code) ?? 0) + 1);
  }

  let fnshopCalls = 0;
  for (const row of input.fnshop) {
    if (row.action === "verify_license") continue;
    fnshopCalls += 1;
    const bucket = byDay.get(mexicoDay(row.created_at));
    if (bucket) bucket.fnshop += 1;
  }

  const asked = totals.answered + totals.fallback + totals.failed;
  const handled = totals.answered + fnshopCalls;
  const activeDays = totals.firstCallAt ? Math.max(1, (input.now.getTime() - Date.parse(totals.firstCallAt)) / 86_400_000) : 1;
  return {
    totals,
    pacePerDay: Math.round((totals.calls / activeDays) * 10) / 10,
    share: { own: totals.answered, fnshop: fnshopCalls, ownPercent: handled > 0 ? Math.round((totals.answered / handled) * 1000) / 10 : null },
    answerRate: asked > 0 ? Math.round((totals.answered / asked) * 1000) / 10 : null,
    byDay: [...byDay.values()],
    byAction: [...actions.values()]
      .map(({ durations, ...rest }) => {
        const sorted = [...durations].sort((left, right) => left - right);
        return { ...rest, p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95) };
      })
      .sort((left, right) => right.calls - left.calls),
    codes: [...codes.entries()].map(([code, calls]) => ({ code, calls })).sort((left, right) => right.calls - left.calls),
  };
}
