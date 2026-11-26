import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { calculateAuthoritativePrice, type PriceTier } from "../domain/price-calculator";

export interface CatalogPricingProvider {
  price(items: readonly CatalogItem[]): Promise<ReadonlyMap<string, number | null>>;
}

type RuleRow = { min_vbucks: number; max_vbucks: number | null; mxn_per_hundred: number | string };
type OverrideRow = { main_id: string; amount_mxn_cents: number; effective_from: string };

/**
 * `.in("main_id", ids)` viaja en la URL. Con la tienda completa (550+ objetos) la URL pasaba de
 * 16 KB y Supabase la rechazaba (HeadersOverflowError), lo que tumbaba el build en /carrito.
 * Por eso los IDs se consultan en grupos.
 */
export const OVERRIDE_IDS_PER_REQUEST = 100;

export function chunk<T>(values: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < values.length; start += size) out.push(values.slice(start, start + size));
  return out;
}

export class SupabasePricingProvider implements CatalogPricingProvider {
  constructor(private readonly database: SupabaseClient) {}

  async price(items: readonly CatalogItem[]): Promise<ReadonlyMap<string, number | null>> {
    const now = new Date().toISOString();
    const ids = [...new Set(items.map((item) => item.mainId))];
    const [rulesResult, overridesResults] = await Promise.all([
      this.database.from("price_rules").select("min_vbucks,max_vbucks,mxn_per_hundred")
        .eq("active", true).lte("effective_from", now).or(`effective_until.is.null,effective_until.gt.${now}`)
        .order("min_vbucks"),
      Promise.all(chunk(ids, OVERRIDE_IDS_PER_REQUEST).map((group) =>
        this.database.from("offer_price_overrides").select("main_id,amount_mxn_cents,effective_from")
          .in("main_id", group).eq("active", true).lte("effective_from", now)
          .or(`effective_until.is.null,effective_until.gt.${now}`).order("effective_from", { ascending: false })))
    ]);
    if (rulesResult.error) throw rulesResult.error;
    const failed = overridesResults.find((result) => result.error);
    if (failed?.error) throw failed.error;

    const tiers: PriceTier[] = ((rulesResult.data ?? []) as RuleRow[]).map((rule) => ({
      minVbucks: rule.min_vbucks,
      maxVbucks: rule.max_vbucks,
      mxnPerHundred: Number(rule.mxn_per_hundred)
    }));
    // Cada main_id está en un solo grupo y cada grupo viene del más nuevo al más viejo: gana el primero.
    const overrides = new Map<string, number>();
    for (const override of overridesResults.flatMap((result) => (result.data ?? []) as OverrideRow[])) {
      if (!overrides.has(override.main_id)) overrides.set(override.main_id, override.amount_mxn_cents / 100);
    }

    return new Map(items.map((item) => {
      const override = overrides.get(item.mainId);
      try { return [item.mainId, calculateAuthoritativePrice(item.finalPriceVbucks, tiers, override === undefined ? undefined : Math.round(override * 100))] as const; }
      catch { return [item.mainId, null] as const; }
    }));
  }
}
