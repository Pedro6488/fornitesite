import { describe, expect, it } from "vitest";
import { canPurchase, isCatalogItemDisplayable, type CatalogItem } from "./catalog-item";

const base: CatalogItem = { mainId: "id", offerId: "offer", name: "Objeto", description: "", imageUrl: null, type: "Atuendo", rarity: "Raro", regularPriceVbucks: 500, finalPriceVbucks: 500, priceMxn: 40, giftable: true, availableUntil: null, featured: false };
describe("canPurchase", () => {
  it("requiere oferta, regalo y precio", () => expect(canPurchase(base)).toBe(true));
  it("rechaza una oferta informativa", () => expect(canPurchase({ ...base, offerId: null })).toBe(false));
  it("rechaza objetos no regalables", () => expect(canPurchase({ ...base, giftable: false })).toBe(false));
  it("solo muestra objetos con identidad, tipo, precio e imagen", () => {
    const displayable = { ...base, imageUrl: "https://fortnite-api.com/item.png" };
    expect(isCatalogItemDisplayable(displayable)).toBe(true);
    expect(isCatalogItemDisplayable({ ...displayable, name: "Objeto sin nombre" })).toBe(false);
    expect(isCatalogItemDisplayable({ ...displayable, imageUrl: null })).toBe(false);
    expect(isCatalogItemDisplayable({ ...displayable, type: "Objeto" })).toBe(false);
  });
});
