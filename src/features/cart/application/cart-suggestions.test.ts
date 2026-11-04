import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { suggestForCart } from "./cart-suggestions";

const item = (overrides: Partial<CatalogItem>): CatalogItem => ({
  mainId: "item",
  offerId: "offer",
  name: "Objeto",
  description: "",
  imageUrl: null,
  type: "Pico",
  rarity: "Raro",
  regularPriceVbucks: 500,
  finalPriceVbucks: 500,
  priceMxn: 40,
  giftable: true,
  availableUntil: null,
  featured: false,
  ...overrides,
});

describe("suggestForCart", () => {
  it("prioriza la colección y el tipo, y excluye lo que ya está en el carrito", () => {
    const catalog = [
      item({ mainId: "otro", type: "Gesto" }),
      item({ mainId: "tipo", type: "Atuendo" }),
      item({ mainId: "coleccion", type: "Gesto", collaboration: "Saga" }),
      item({ mainId: "en-carrito", type: "Atuendo", collaboration: "Saga" }),
    ];

    expect(suggestForCart(catalog, ["en-carrito"]).map(({ mainId }) => mainId)).toEqual(["coleccion", "tipo", "otro"]);
  });

  it("omite lo que no se puede comprar y respeta el límite", () => {
    const catalog = [
      item({ mainId: "sin-oferta", offerId: null }),
      item({ mainId: "uno" }),
      item({ mainId: "dos" }),
    ];

    expect(suggestForCart(catalog, [], 1).map(({ mainId }) => mainId)).toEqual(["uno"]);
  });
});
