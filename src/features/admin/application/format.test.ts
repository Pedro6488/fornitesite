import { describe, expect, it } from "vitest";
import { formatItemMoney, formatOrderMoney } from "./format";

describe("order money in the console", () => {
  it("shows dollar orders with the saved USD amount, not the peso equivalent", () => {
    const text = formatOrderMoney({ currency: "USD", amount_mxn_cents: 30000, amount_usd_cents: 1750 });
    expect(text).toContain("17.50");
    expect(text).toContain("USD");
    expect(text).not.toContain("300");
  });

  it("shows peso orders in pesos", () => {
    expect(formatOrderMoney({ currency: "MXN", amount_mxn_cents: 30000, amount_usd_cents: null })).toBe("$300");
    expect(formatOrderMoney({ amount_mxn_cents: 12950 })).toBe("$129.50");
  });

  it("multiplies item quantity in the order currency", () => {
    expect(formatItemMoney("USD", { unit_amount_mxn_cents: 30000, unit_amount_usd_cents: 500, quantity: 2 })).toContain("10");
    expect(formatItemMoney("MXN", { unit_amount_mxn_cents: 30000, unit_amount_usd_cents: null, quantity: 2 })).toBe("$600");
  });
});
