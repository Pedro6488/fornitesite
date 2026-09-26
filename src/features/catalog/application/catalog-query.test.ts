import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../domain/catalog-item";
import { countCatalogCategories, filterCatalog, getCatalogCategory } from "./catalog-query";

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

  it("cuenta únicamente las categorías presentes", () => {
    const counts = countCatalogCategories([catalogItem(), catalogItem({ mainId: "pickaxe", type: "Pickaxe" })]);
    expect(counts.Todos).toBe(2);
    expect(counts.Atuendos).toBe(1);
    expect(counts.Picos).toBe(1);
  });
});
