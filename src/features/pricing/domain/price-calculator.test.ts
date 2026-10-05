import { describe, expect, it } from "vitest";
import { calculateAuthoritativePrice, calculateMxnPrice, formatMxn, priceTiersOverlap, UnsupportedVbucksPriceError } from "./price-calculator";

describe("calculateMxnPrice", () => {
  it.each([
    [300, 30], [500, 40], [1_499, 120], [1_500, 113], [1_800, 135], [3_000, 210]
  ])("calcula %i paVos como $%i MXN", (vbucks, expected) => {
    expect(calculateMxnPrice(vbucks)).toBe(expected);
  });

  it("redondea siempre hacia arriba", () => expect(calculateMxnPrice(2_300)).toBe(173));
  it("rechaza cantidades fuera de las reglas", () => expect(() => calculateMxnPrice(99)).toThrow(UnsupportedVbucksPriceError));
  it("rechaza cantidades no enteras", () => expect(() => calculateMxnPrice(500.5)).toThrow(UnsupportedVbucksPriceError));
  it("formatea el precio como MXN", () => expect(formatMxn(113)).toContain("113"));
});

describe("calculateAuthoritativePrice", () => {
  const tiers = [{ minVbucks: 1_000, maxVbucks: 2_000, mxnPerHundred: 7.5 }];

  it("da prioridad a la excepción del producto", () => {
    expect(calculateAuthoritativePrice(1_500, tiers, 9_900)).toBe(99);
  });

  it("usa la regla y redondea hacia arriba sin excepción", () => {
    expect(calculateAuthoritativePrice(1_501, tiers)).toBe(113);
  });
});

describe("priceTiersOverlap", () => {
  it("detecta cruces incluso en límites inclusivos", () => {
    expect(priceTiersOverlap(
      { minVbucks: 100, maxVbucks: 500, mxnPerHundred: 10 },
      { minVbucks: 500, maxVbucks: 900, mxnPerHundred: 8 }
    )).toBe(true);
  });

  it("permite rangos contiguos sin intersección", () => {
    expect(priceTiersOverlap(
      { minVbucks: 100, maxVbucks: 499, mxnPerHundred: 10 },
      { minVbucks: 500, maxVbucks: null, mxnPerHundred: 8 }
    )).toBe(false);
  });
});
