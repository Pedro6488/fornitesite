import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { calculateAuthoritativePrice, type PriceTier } from "../domain/price-calculator";

export interface CatalogPricingProvider {
  price(items: readonly CatalogItem[]): Promise<ReadonlyMap<string, number | null>>;
}

type RuleRow = { min_vbucks: number; max_vbucks: number | null; mxn_per_hundred: number | string };
type OverrideRow = { main_id: string; amount_mxn_cents: number; effective_from: string };

export class SupabasePricingProvider implements CatalogPricingProvider {
  constructor(private readonly database: SupabaseClient) {}

  async price(items: readonly CatalogItem[]): Promise<ReadonlyMap<string, number | null>> {
    const now = new Date().toISOString();
    const ids = [...new Set(items.map((item) => item.mainId))];
    const [rulesResult, overridesResult] = await Promise.all([
      this.database.from("price_rules").select("min_vbucks,max_vbucks,mxn_per_hundred")
        .eq("active", true).lte("effective_from", now).or(`effective_until.is.null,effective_until.gt.${now}`)
        .order("min_vbucks"),
      ids.length
        ? this.database.from("offer_price_overrides").select("main_id,amount_mxn_cents,effective_from")
          .in("main_id", ids).eq("active", true).lte("effective_from", now)
          .or(`effective_until.is.null,effective_until.gt.${now}`).order("effective_from", { ascending: false })
        : Promise.resolve({ data: [], error: null })
    ]);
    if (rulesResult.error) throw rulesResult.error;
    if (overridesResult.error) throw overridesResult.error;

    const tiers: PriceTier[] = ((rulesResult.data ?? []) as RuleRow[]).map((rule) => ({
      minVbucks: rule.min_vbucks,
      maxVbucks: rule.max_vbucks,
      mxnPerHundred: Number(rule.mxn_per_hundred)
    }));
    const overrides = new Map<string, number>();
    for (const override of (overridesResult.data ?? []) as OverrideRow[]) {
      if (!overrides.has(override.main_id)) overrides.set(override.main_id, override.amount_mxn_cents / 100);
    }

    return new Map(items.map((item) => {
      const override = overrides.get(item.mainId);
      try { return [item.mainId, calculateAuthoritativePrice(item.finalPriceVbucks, tiers, override === undefined ? undefined : Math.round(override * 100))] as const; }
      catch { return [item.mainId, null] as const; }
    }));
  }
}
