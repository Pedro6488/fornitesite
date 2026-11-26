import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { OVERRIDE_IDS_PER_REQUEST, SupabasePricingProvider, chunk } from "./supabase-pricing-provider";

type Row = Record<string, unknown>;

/** Minimal Supabase query builder: records every `.in()` list and answers from fixed rows. */
function fakeDatabase(tables: Record<string, Row[]>, errors: Record<string, { code: string }> = {}) {
  const inCalls: string[][] = [];
  const database = {
    from(table: string) {
      let ids: string[] | null = null;
      const builder = {
        select: () => builder,
        eq: () => builder,
        lte: () => builder,
        or: () => builder,
        in: (_column: string, values: string[]) => {
          ids = values;
          inCalls.push(values);
          return builder;
        },
        order: () => builder,
        then(resolve: (value: { data: Row[] | null; error: { code: string } | null }) => unknown) {
          const rows = tables[table] ?? [];
          return Promise.resolve({ data: errors[table] ? null : ids ? rows.filter((row) => ids!.includes(String(row.main_id))) : rows, error: errors[table] ?? null }).then(resolve);
        },
      };
      return builder;
    },
  };
  return { database: database as unknown as SupabaseClient, inCalls };
}

const item = (n: number, vbucks = 800) => ({ mainId: `main-${String(n).padStart(4, "0")}-${"x".repeat(20)}`, finalPriceVbucks: vbucks }) as unknown as CatalogItem;

describe("SupabasePricingProvider", () => {
  it.each(["42P01", "PGRST205"])("conserva los precios anteriores cuando falta la tabla nueva (%s)", async (code) => {
    const items = [item(0), item(1)];
    const tables = {
      price_rules: [{ min_vbucks: 1, max_vbucks: null, mxn_per_hundred: 10 }],
      offer_price_overrides: [{ main_id: items[1].mainId, amount_mxn_cents: 7750 }],
    };
    const missing = new SupabasePricingProvider(fakeDatabase(tables, { collection_price_rules: { code } }).database);
    const migrated = new SupabasePricingProvider(fakeDatabase({ ...tables, collection_price_rules: [] }).database);
    const before = await missing.price(items);
    const after = await migrated.price(items);
    expect([...after]).toEqual([...before]);
    expect(after.get(items[0].mainId)).toBe(80);
    expect(after.get(items[1].mainId)).toBe(77.5);
  });

  it("aplica una regla a todos los objetos de un apartado, conserva excepciones y no descuenta otras secciones", async () => {
    const items = [0, 1, 2, 3].map((n) => ({ ...item(n), collaboration: n === 2 ? "Miku" : n === 3 ? null : " Es hora de anotar " }));
    const { database } = fakeDatabase({
      price_rules: [{ min_vbucks: 1, max_vbucks: null, mxn_per_hundred: 10 }],
      collection_price_rules: [{ collection: "Es hora de anotar", mxn_per_hundred: "7.50" }, { collection: "Otros objetos", mxn_per_hundred: 5 }],
      offer_price_overrides: [{ main_id: items[1].mainId, amount_mxn_cents: 7750 }],
    });
    const prices = await new SupabasePricingProvider(database).price(items);
    expect(prices.get(items[0].mainId)).toBe(60);
    expect(prices.get(items[1].mainId)).toBe(77.5);
    expect(prices.get(items[2].mainId)).toBe(80);
    expect(prices.get(items[3].mainId)).toBe(40);
    // Un objeto recién agregado hereda la regla sin crear excepciones individuales.
    const added = { ...item(10), collaboration: "Es hora de anotar" };
    expect((await new SupabasePricingProvider(database).price([added])).get(added.mainId)).toBe(60);
  });

  it("puede fijar tarifa de colección aunque no exista un rango general", async () => {
    const current = { ...item(0, 1500), collaboration: "Miku" };
    const { database } = fakeDatabase({ price_rules: [], collection_price_rules: [{ collection: "Miku", mxn_per_hundred: 7.5 }] });
    expect((await new SupabasePricingProvider(database).price([current])).get(current.mainId)).toBe(113);
  });

  it("asks for overrides in groups, so a full shop never makes a URL too long", async () => {
    const items = Array.from({ length: 560 }, (_, n) => item(n));
    const { database, inCalls } = fakeDatabase({
      price_rules: [{ min_vbucks: 0, max_vbucks: null, mxn_per_hundred: 10 }],
      offer_price_overrides: [
        { main_id: items[3]!.mainId, amount_mxn_cents: 9900, effective_from: "2026-11-20" },
        { main_id: items[3]!.mainId, amount_mxn_cents: 5000, effective_from: "2026-11-01" },
        { main_id: items[450]!.mainId, amount_mxn_cents: 12300, effective_from: "2026-11-20" },
      ],
    });

    const prices = await new SupabasePricingProvider(database).price(items);

    expect(inCalls.length).toBe(Math.ceil(560 / OVERRIDE_IDS_PER_REQUEST));
    expect(Math.max(...inCalls.map((ids) => ids.length))).toBeLessThanOrEqual(OVERRIDE_IDS_PER_REQUEST);
    expect(inCalls.flat()).toHaveLength(560);
    expect(prices.size).toBe(560);
    expect(prices.get(items[3]!.mainId)).not.toBe(prices.get(items[4]!.mainId));
    expect(prices.get(items[450]!.mainId)).not.toBe(prices.get(items[451]!.mainId));
  });

  it("makes no override request for an empty list", async () => {
    const { database, inCalls } = fakeDatabase({ price_rules: [] });
    expect((await new SupabasePricingProvider(database).price([])).size).toBe(0);
    expect(inCalls).toEqual([]);
  });
});

describe("chunk", () => {
  it("splits without losing or repeating values", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
