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

const MIN = 100, MAX = 50_000;
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

/** Precio efectivo por 100 en el peor caso de un bono: el tramo dado con el bono completo. */
export const effectiveWithBonus = (centsPer100: number, bonusBp: number) => centsPer100 * 10_000 / (10_000 + bonusBp);
