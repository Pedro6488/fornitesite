import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../domain/catalog-item";
import { groupCatalogByCollaboration } from "./catalog-query";

const item = (overrides: Partial<CatalogItem>): CatalogItem => ({
  mainId: "item",
  offerId: null,
  name: "Objeto",
  description: "",
  imageUrl: "https://fortnite-api.com/item.png",
  type: "Outfit",
  rarity: "Epic",
  regularPriceVbucks: 1_500,
  finalPriceVbucks: 1_500,
  priceMxn: null,
  giftable: false,
  availableUntil: null,
  featured: false,
  ...overrides
});

describe("groupCatalogByCollaboration", () => {
  it("agrupa las colaboraciones por nombre y prioriza sus lotes", () => {
    const groups = groupCatalogByCollaboration([
      item({ mainId: "madison-pickaxe", name: "Pico Madison", collaboration: "Madison Beer", type: "Pickaxe" }),
      item({ mainId: "madison-bundle", name: "Lote Madison Beer", collaboration: "Madison Beer", type: "Lote" }),
      item({ mainId: "toy", name: "Alien", collaboration: "Disney" })
    ]);

    expect(groups.map((group) => group.name)).toEqual(["Disney", "Madison Beer"]);
    expect(groups[1].items.map((catalogItem) => catalogItem.mainId)).toEqual([
      "madison-bundle",
      "madison-pickaxe"
    ]);
  });
});
