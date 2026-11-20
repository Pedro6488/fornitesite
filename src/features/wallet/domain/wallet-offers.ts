import type { WalletRate } from "./wallet";

/**
 * Tarifa por volumen y bonos por campaña. Replica `wallet_topup_quote` de la base para mostrar
 * al cliente el total y el regalo antes de crear la recarga; la base vuelve a calcularlo y rechaza
 * con `rate_changed` o `promo_changed` si algo cambió. Las ofertas que llegan aquí ya vienen
 * filtradas por la base (vigentes, con margen válido y, si aplica, solo para primera recarga).
 */
export type WalletTier = { id: string; region: "mx" | "us"; min_vbucks: number; cents_per_100: number; active?: boolean; updated_at?: string };
export type WalletBonus = {
  id: string; region: "mx" | "us"; label: string; min_vbucks: number; bonus_bp: number; bonus_cap: number | null;
  first_topup_only: boolean; ends_at: string; starts_at?: string; active?: boolean;
};
export type TopupQuote = { cents: number; centsPer100: number; tier: WalletTier | null; bonus: number; bonusRule: WalletBonus | null; credited: number; effectivePer100: number };

export const WALLET_MIN = 100;
export const WALLET_MAX = 50_000;
const MIN = WALLET_MIN, MAX = WALLET_MAX;

/** Valida `?cantidad=` de la URL: múltiplo de 100 dentro del rango, o null. */
export function parseWalletAmount(raw: string | string[] | undefined | null) {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value >= MIN && value <= MAX && value % 100 === 0 ? value : null;
}
const validAmount = (vbucks: number) => Number.isInteger(vbucks) && vbucks >= MIN && vbucks <= MAX && vbucks % 100 === 0;
const bonusFor = (vbucks: number, rule: WalletBonus) => Math.min(Math.floor(vbucks * rule.bonus_bp / 10_000), rule.bonus_cap ?? Number.MAX_SAFE_INTEGER);

export function topupQuote(vbucks: number, rate: WalletRate | undefined, tiers: readonly WalletTier[] = [], bonuses: readonly WalletBonus[] = []): TopupQuote | null {
  if (!rate?.active || !rate.cents_per_100 || !validAmount(vbucks)) return null;
  const tier = tiers.filter((t) => t.region === rate.region && t.min_vbucks <= vbucks).toSorted((a, b) => b.min_vbucks - a.min_vbucks)[0] ?? null;
  const centsPer100 = tier?.cents_per_100 ?? rate.cents_per_100;
  const cents = vbucks / 100 * centsPer100;
  const best = bonuses.filter((b) => b.region === rate.region && b.min_vbucks <= vbucks)
    .map((rule) => ({ rule, amount: bonusFor(vbucks, rule) }))
    .toSorted((a, b) => b.amount - a.amount || (a.rule.id < b.rule.id ? -1 : 1))[0];
  const bonus = best?.amount ?? 0;
  return { cents, centsPer100, tier, bonus, bonusRule: best && bonus > 0 ? best.rule : null, credited: vbucks + bonus, effectivePer100: cents / (vbucks + bonus) * 100 };
}

/** El siguiente escalón que baja el precio efectivo por 100: "agrega 500 y recibe +250 de regalo". */
export function nextOffer(vbucks: number, rate: WalletRate | undefined, tiers: readonly WalletTier[] = [], bonuses: readonly WalletBonus[] = []) {
  const current = topupQuote(vbucks, rate, tiers, bonuses);
  if (!current || !rate) return null;
  const thresholds = [...new Set([...tiers, ...bonuses].filter((o) => o.region === rate.region && o.min_vbucks > vbucks).map((o) => o.min_vbucks))].toSorted((a, b) => a - b);
  for (const target of thresholds) {
    const quote = topupQuote(target, rate, tiers, bonuses);
    if (quote && quote.effectivePer100 < current.effectivePer100) return { target, add: target - vbucks, quote };
  }
  return null;
}

/** Margen sobre el costo, en puntos base (1500 = 15 %). Null si no hay costo capturado. */
export function marginBp(effectiveCentsPer100: number, costCentsPer100: number | null | undefined) {
  if (!costCentsPer100) return null;
  return Math.round((effectiveCentsPer100 - costCentsPer100) / costCentsPer100 * 10_000);
}

/** Precio por 100 más bajo que se puede cobrar: costo × (1 + margen mínimo), la misma regla que valida la base. Null sin costo. */
export function minAllowedPer100(rate: Pick<WalletRate, "cost_cents_per_100" | "min_margin_bp"> | undefined) {
  if (!rate?.cost_cents_per_100) return null;
  return Math.ceil(rate.cost_cents_per_100 * (10_000 + (rate.min_margin_bp ?? 0)) / 10_000);
}

/** Un escalón de la escalera tal como lo edita el admin (texto de los campos). */
export type LadderRow = { key: string; id: string | null; min: string; price: string; active: boolean };
export type LadderStep = { row: LadderRow; min: number; cents: number };

/**
 * Revisa la escalera completa antes de guardarla: cada escalón activo debe empezar en una cantidad
 * válida y distinta, costar menos que la tarifa base y que el escalón anterior ("entre más compras,
 * más barato") y no bajar del mínimo permitido por el costo y el margen. Devuelve el problema de
 * cada fila (por `key`) y los escalones ya convertidos a números.
 */
export function checkLadder(rows: readonly LadderRow[], rate: WalletRate | undefined, money: (cents: number) => string) {
  const problems: Record<string, string> = {};
  const steps: LadderStep[] = [];
  const base = rate?.cents_per_100 ?? null;
  const floor = minAllowedPer100(rate);
  for (const row of rows) {
    const filled = row.min.trim() !== "" || row.price.trim() !== "";
    if (!filled) continue;
    const min = Number(row.min), cents = Math.round(Number(row.price) * 100);
    if (!row.min.trim() || !row.price.trim()) problems[row.key] = "Completa «desde» y el precio.";
    else if (!Number.isInteger(min) || min < WALLET_MIN || min > WALLET_MAX || min % 100 !== 0) problems[row.key] = `«Desde» va de ${WALLET_MIN} a ${WALLET_MAX.toLocaleString("es-MX")} pavos, en múltiplos de 100.`;
    else if (!Number.isFinite(cents) || cents < 1) problems[row.key] = "Escribe un precio válido.";
    else steps.push({ row, min, cents });
  }
  const seen = new Map<number, string>();
  for (const step of steps) {
    if (seen.has(step.min)) problems[step.row.key] = `Ya hay un escalón desde ${step.min.toLocaleString("es-MX")} pavos.`;
    else seen.set(step.min, step.row.key);
  }
  const active = steps.filter((step) => step.row.active && !problems[step.row.key]).toSorted((a, b) => a.min - b.min);
  let previous: LadderStep | null = null;
  for (const step of active) {
    if (base === null) problems[step.row.key] = "Guarda primero la tarifa base de esta región.";
    else if (floor === null) problems[step.row.key] = "Captura tu costo por 100 en la tarifa: sin costo no se puede revisar el margen.";
    else if (step.cents < floor) problems[step.row.key] = `Mínimo permitido: ${money(floor)} (tu costo ${money(rate!.cost_cents_per_100!)} + margen ${((rate?.min_margin_bp ?? 0) / 100).toLocaleString("es-MX")}%).`;
    else if (step.cents >= base) problems[step.row.key] = `Debe costar menos que la tarifa base (${money(base)}).`;
    else if (previous && step.cents >= previous.cents) problems[step.row.key] = `Debe costar menos que el escalón desde ${previous.min.toLocaleString("es-MX")} (${money(previous.cents)}).`;
    if (!problems[step.row.key]) previous = step;
  }
  return { problems, steps };
}

/** Precio efectivo por 100 en el peor caso de un bono: el tramo dado con el bono completo. */
export const effectiveWithBonus = (centsPer100: number, bonusBp: number) => centsPer100 * 10_000 / (10_000 + bonusBp);

/** Lo que se puede mostrar sin sesión: tarifas activas y ofertas vigentes. */
export type PublicWalletOffers = { rates: WalletRate[]; tiers: WalletTier[]; bonuses: WalletBonus[] };

/**
 * Resumen para anunciar los pavos de una región: la tarifa base, el precio por 100 más bajo
 * que se alcanza con volumen (con su mínimo) y el mayor regalo vigente. Null si la región aún
 * no cobra recargas, para no anunciar un precio que no existe.
 */
export function offerHighlights(region: "mx" | "us", offers: Pick<PublicWalletOffers, "rates" | "tiers" | "bonuses"> | null | undefined) {
  const rate = offers?.rates.find((item) => item.region === region && item.active && item.cents_per_100);
  if (!rate?.cents_per_100) return null;
  const tiers = offers!.tiers.filter((tier) => tier.region === region).toSorted((a, b) => a.cents_per_100 - b.cents_per_100);
  const cheapest = tiers[0] && tiers[0].cents_per_100 < rate.cents_per_100 ? tiers[0] : null;
  const bonus = offers!.bonuses.filter((item) => item.region === region).toSorted((a, b) => b.bonus_bp - a.bonus_bp)[0] ?? null;
  return { rate, basePer100: rate.cents_per_100, cheapest, bonus };
}
