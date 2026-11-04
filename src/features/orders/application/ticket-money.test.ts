import { describe, expect, it } from "vitest";
import { ticketMoney } from "./ticket-money";

describe("ticket money", () => {
  it("uses the saved USD amount instead of converting MXN", () => {
    expect(ticketMoney("USD", 30000, 1750)).toContain("17.50");
    expect(ticketMoney("USD", 30000, 1750)).toContain("USD");
  });
  it("labels pesos and multiplies item quantities", () => {
    expect(ticketMoney("MXN", 30000, 1750, 2)).toBe("$600.00 MXN");
  });
  it("omits unavailable or invalid prices without falling back to pesos", () => {
    expect(ticketMoney("USD", 30000, null)).toBe("");
    expect(ticketMoney(undefined, 30000)).toBe("");
    expect(ticketMoney("USD", 30000, NaN)).toBe("");
  });
});
