import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../domain/catalog-item";
import {
  countCatalogCategories,
  filterCatalog,
  getCatalogCategory,
  getLatestShopDate,
  sortCatalog
} from "./catalog-query";

const catalogItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  mainId: "item",
  offerId: null,
  name: "Exploradora estelar",
  description: "Atuendo reactivo",
  imageUrl: null,
  type: "Outfit",
  rarity: "Épico",
  regularPriceVbucks: 1_500,
  finalPriceVbucks: 1_500,
  priceMxn: 113,
  giftable: false,
  availableUntil: null,
  featured: false,
  ...overrides
});

describe("catalog-query", () => {
  it("normaliza tipos de la API a categorías en español", () => {
    expect(getCatalogCategory(catalogItem({ type: "Pickaxe" }))).toBe("Picos");
    expect(getCatalogCategory(catalogItem({ type: "Back Bling" }))).toBe("Mochilas");
    expect(getCatalogCategory(catalogItem({ type: "Music" }))).toBe("Otros");
  });

  it("busca sin distinguir mayúsculas ni acentos", () => {
    expect(filterCatalog([catalogItem()], "exploradora epico", "Todos")).toHaveLength(1);
  });

  it("encuentra objetos por el nombre de su colaboración", () => {
    const items = [
      catalogItem({
        mainId: "leon",
        name: "Leon S. Kennedy",
        collaboration: "Resident Evil"
      })
    ];

    expect(filterCatalog(items, "resident evil", "Todos").map((item) => item.mainId)).toEqual([
      "leon"
    ]);
  });

  it("combina búsqueda y categoría", () => {
    const items = [catalogItem(), catalogItem({ mainId: "pickaxe", name: "Pico solar", type: "Pickaxe" })];
    expect(filterCatalog(items, "solar", "Picos").map((item) => item.mainId)).toEqual(["pickaxe"]);
  });

  it("coloca primero las ofertas que acaban de entrar a la tienda", () => {
    const items = [
      catalogItem({ mainId: "old", name: "Anterior", shopInDate: "2026-09-25T00:00:00Z" }),
      catalogItem({ mainId: "new", name: "Resident Evil", shopInDate: "2026-09-26T00:00:00Z" })
    ];

    expect(sortCatalog(items, "newest").map((item) => item.mainId)).toEqual(["new", "old"]);
    expect(getLatestShopDate(items)).toBe("2026-09-26T00:00:00Z");
  });

  it("usa la posición oficial de la tienda para popular ahora", () => {
    const items = [
      catalogItem({ mainId: "later", shopLayoutIndex: 12, shopLayoutRank: 200 }),
      catalogItem({ mainId: "first", shopLayoutIndex: 2, shopLayoutRank: 100 })
    ];

    expect(sortCatalog(items, "featured").map((item) => item.mainId)).toEqual(["first", "later"]);
  });

  it("cuenta únicamente las categorías presentes", () => {
    const counts = countCatalogCategories([catalogItem(), catalogItem({ mainId: "pickaxe", type: "Pickaxe" })]);
    expect(counts.Todos).toBe(2);
    expect(counts.Atuendos).toBe(1);
    expect(counts.Picos).toBe(1);
  });
});
