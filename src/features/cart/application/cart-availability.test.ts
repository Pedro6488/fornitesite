import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { resolveCartAvailability } from "./cart-availability";

const item = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  mainId: "available",
  offerId: "offer",
  name: "Objeto",
  description: "",
  imageUrl: null,
  type: "Atuendo",
  rarity: "Raro",
  regularPriceVbucks: 500,
  finalPriceVbucks: 500,
  priceMxn: 40,
  giftable: true,
  availableUntil: null,
  featured: false,
  ...overrides
});

describe("resolveCartAvailability", () => {
  it("conserva los IDs ausentes o vencidos para que el usuario pueda eliminarlos", () => {
    const entries = resolveCartAvailability([
      "available",
      "expired",
      "missing"
    ], [
      item(),
      item({ mainId: "expired", availableUntil: "2026-10-15T23:59:59.000Z" })
    ], Date.parse("2026-10-16T00:00:00.000Z"));

    expect(entries).toEqual([
      expect.objectContaining({ itemId: "available", available: true }),
      expect.objectContaining({ itemId: "expired", available: false }),
      { itemId: "missing", item: null, available: false }
    ]);
  });
});
