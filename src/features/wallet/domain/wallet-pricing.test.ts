import { describe, expect, it } from "vitest";
import { compareWalletPrice, paypalNetCents } from "./wallet";

const rate = (cents: number | null) => ({ region: "mx" as const, cents_per_100: cents, active: true });

describe("precio con pavos contra pago habitual", () => {
  it("conviene pavos en objetos chicos con la tarifa en $7.50 por 100", () => {
    // Emote de 200: pago habitual $20 (tramo de $10 por 100) contra 200 pavos ≈ $15.
    expect(compareWalletPrice(2000, 200, rate(750))).toEqual({ regularCents: 2000, equivalentCents: 1500, savingsCents: 500 });
  });

  it("detecta cuando el pago habitual sale más barato", () => {
    // Lote de 3,000: pago habitual $210 (tramo de $7) contra 3,000 pavos ≈ $225.
    expect(compareWalletPrice(21000, 3000, rate(750))?.savingsCents).toBe(-1500);
  });

  it("no compara sin tarifa o sin total", () => {
    expect(compareWalletPrice(2000, 200, rate(null))).toBeNull();
    expect(compareWalletPrice(null, 200, rate(750))).toBeNull();
    expect(compareWalletPrice(2000, 200, undefined)).toBeNull();
  });

  it("descuenta la comisión de PayPal (5.4% + $0.30) del cobro de una recarga", () => {
    expect(paypalNetCents(5000)).toBe(5000 - 270 - 30);
    expect(paypalNetCents(10)).toBe(0);
  });
});
