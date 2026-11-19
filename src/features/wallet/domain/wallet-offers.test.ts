import { describe, expect, it } from "vitest";
import { marginBp, nextOffer, offerHighlights, parseWalletAmount, topupQuote, type WalletBonus, type WalletTier } from "./wallet-offers";

const rate = { region: "mx" as const, cents_per_100: 750, active: true };
const tiers: WalletTier[] = [{ id: "t5", region: "mx", min_vbucks: 5000, cents_per_100: 700 }];
const bonuses: WalletBonus[] = [
  { id: "b1", region: "mx", label: "Noviembre +5%", min_vbucks: 5000, bonus_bp: 500, bonus_cap: null, first_topup_only: false, ends_at: "2026-11-30T23:59:00Z" },
  { id: "b2", region: "mx", label: "Tope", min_vbucks: 10000, bonus_bp: 1000, bonus_cap: 600, first_topup_only: false, ends_at: "2026-11-30T23:59:00Z" },
];

describe("tarifa por volumen y bonos (mismo cálculo que la base)", () => {
  it("sin tramo ni bono usa la tarifa base", () => {
    expect(topupQuote(4500, rate, tiers, bonuses)).toMatchObject({ cents: 33750, centsPer100: 750, bonus: 0, credited: 4500 });
  });

  it("desde 5,000 aplica el tramo y el bono: Ana paga $350 y recibe 5,250", () => {
    const quote = topupQuote(5000, rate, tiers, bonuses)!;
    expect(quote).toMatchObject({ cents: 35000, centsPer100: 700, bonus: 250, credited: 5250 });
    expect(quote.bonusRule?.label).toBe("Noviembre +5%");
    expect(quote.effectivePer100).toBeCloseTo(666.67, 1);
  });

  it("elige el bono mayor sin sumarlos y respeta el tope", () => {
    // 10,000: +5 % = 500, +10 % con tope 600 = 600 → gana el de tope.
    expect(topupQuote(10000, rate, tiers, bonuses)).toMatchObject({ bonus: 600, bonusRule: { id: "b2" } });
    // 20,000: +5 % = 1,000 supera al de tope (600).
    expect(topupQuote(20000, rate, tiers, bonuses)).toMatchObject({ bonus: 1000, bonusRule: { id: "b1" } });
  });

  it("sugiere el siguiente escalón que baja el precio efectivo", () => {
    expect(nextOffer(4500, rate, tiers, bonuses)).toMatchObject({ target: 5000, add: 500, quote: { bonus: 250 } });
    expect(nextOffer(50000, rate, tiers, bonuses)).toBeNull();
  });

  it("no cotiza sin tarifa activa ni cantidades inválidas", () => {
    expect(topupQuote(5000, { ...rate, active: false }, tiers, bonuses)).toBeNull();
    expect(topupQuote(150, rate)).toBeNull();
  });

  it("calcula el margen sobre el costo", () => {
    expect(marginBp(666.67, 500)).toBe(3333);
    expect(marginBp(700, null)).toBeNull();
  });
});

describe("offerHighlights", () => {
  const rates = [{ region: "mx" as const, active: true, cents_per_100: 750 }, { region: "us" as const, active: false, cents_per_100: 50 }];
  it("anuncia la tarifa, el tramo más barato y el mayor regalo de la región", () => {
    const tiers = [{ id: "a", region: "mx" as const, min_vbucks: 5000, cents_per_100: 700 }, { id: "b", region: "mx" as const, min_vbucks: 13500, cents_per_100: 650 }];
    const bonuses = [{ id: "x", region: "mx" as const, label: "A", min_vbucks: 5000, bonus_bp: 300, bonus_cap: null, first_topup_only: false, ends_at: "2099-01-01T00:00:00Z" }, { id: "y", region: "mx" as const, label: "B", min_vbucks: 5000, bonus_bp: 500, bonus_cap: null, first_topup_only: false, ends_at: "2099-01-01T00:00:00Z" }];
    const result = offerHighlights("mx", { rates, tiers, bonuses });
    expect(result?.basePer100).toBe(750);
    expect(result?.cheapest?.id).toBe("b");
    expect(result?.bonus?.id).toBe("y");
  });
  it("no anuncia nada si la región no cobra recargas o no hay datos", () => {
    expect(offerHighlights("us", { rates, tiers: [], bonuses: [] })).toBeNull();
    expect(offerHighlights("mx", null)).toBeNull();
  });
});

describe("parseWalletAmount", () => {
  it("acepta solo múltiplos de 100 dentro del rango", () => {
    expect(parseWalletAmount("5000")).toBe(5000);
    expect(parseWalletAmount(["2800", "1"])).toBe(2800);
    for (const raw of ["50", "5050", "60000", "abc", undefined, null]) expect(parseWalletAmount(raw)).toBeNull();
  });
});
