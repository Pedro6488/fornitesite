import { describe, expect, it } from "vitest";
import { CatalogService } from "./catalog-service";
import type { CatalogItem, CatalogProvider } from "../domain/catalog-item";

const item = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({ mainId: "CID_TEST", offerId: "visual-offer", name: "Prueba", description: "", imageUrl: "https://fortnite-api.com/item.png", type: "Atuendo", rarity: "Raro", regularPriceVbucks: 1_800, finalPriceVbucks: 1_500, priceMxn: null, giftable: true, availableUntil: null, featured: false, ...overrides });
const provider = (items: readonly CatalogItem[]): CatalogProvider => ({ getCurrentCatalog: async () => items });

describe("CatalogService", () => {
  it("usa FN Shop como fuente transaccional y calcula MXN", async () => {
    const service = new CatalogService(provider([item()]), provider([item({ offerId: "fn-offer", giftable: true })]));
    expect(await service.list()).toEqual([expect.objectContaining({ offerId: "fn-offer", priceMxn: 113, giftable: true })]);
  });
  it("deshabilita la compra cuando no hay coincidencia transaccional", async () => {
    const [result] = await new CatalogService(provider([item()]), provider([])).list();
    expect(result).toEqual(expect.objectContaining({ offerId: null, giftable: false }));
  });
  it("conserva la oferta oficial para el carrito cuando FN Shop no está configurado", async () => {
    const [result] = await new CatalogService(provider([item()])).list();
    expect(result).toEqual(expect.objectContaining({ offerId: "visual-offer", giftable: true, priceMxn: 113 }));
  });
  it("elimina ofertas visuales duplicadas por identificador permanente", async () => {
    const results = await new CatalogService(provider([
      item({ name: "Primera oferta" }),
      item({ name: "Oferta repetida", offerId: "second-offer" })
    ])).list();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Primera oferta");
  });
  it("oculta objetos incompletos antes de construir el catálogo", async () => {
    const results = await new CatalogService(provider([
      item({ mainId: "valid" }),
      item({ mainId: "unnamed", name: "Objeto sin nombre" }),
      item({ mainId: "no-image", imageUrl: null })
    ])).list();
    expect(results.map((result) => result.mainId)).toEqual(["valid"]);
  });
  it("encuentra por identificador permanente", async () => {
    const result = await new CatalogService(provider([item()])).find("CID_TEST");
    expect(result?.name).toBe("Prueba");
  });
  it("devuelve null cuando no existe", async () => {
    expect(await new CatalogService(provider([])).find("missing")).toBeNull();
  });
});
