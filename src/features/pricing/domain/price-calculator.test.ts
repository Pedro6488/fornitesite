import { describe, expect, it } from "vitest";
import { calculateMxnPrice, formatMxn, UnsupportedVbucksPriceError } from "./price-calculator";

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
