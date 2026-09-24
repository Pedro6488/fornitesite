import { afterEach, describe, expect, it, vi } from "vitest";
import { createCatalogService } from "./get-catalog";

const fortniteResponse = {
  data: {
    entries: [
      {
        offerId: "fortnite-offer",
        regularPrice: 2_000,
        finalPrice: 1_500,
        giftable: true,
        outDate: "2026-09-24T00:00:00.000Z",
        brItems: [
          {
            id: "CID_REAL",
            name: "Objeto real",
            description: "Catálogo vigente",
            type: { displayValue: "Atuendo" },
            rarity: { displayValue: "Épico" },
            images: { featured: "https://fortnite-api.com/item.png" }
          }
        ]
      }
    ]
  }
};

afterEach(() => vi.unstubAllGlobals());

describe("createCatalogService", () => {
  it("consulta Fortnite-API aunque FN Shop no esté configurado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fortniteResponse), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const [item] = await createCatalogService({}).list();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://fortnite-api.com/v2/shop",
      { next: { revalidate: 300 } }
    );
    expect(item).toEqual(expect.objectContaining({
      mainId: "CID_REAL",
      name: "Objeto real",
      offerId: null,
      giftable: false,
      priceMxn: 113
    }));
  });

  it("usa FN Shop solamente como catálogo transaccional cuando hay una API key", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(fortniteResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{
          mainId: "CID_REAL",
          offerId: "fnshop-offer",
          price: 1_500,
          giftable: true
        }]
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const [item] = await createCatalogService({ fnShopApiKey: "secret" }).list();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(item).toEqual(expect.objectContaining({
      offerId: "fnshop-offer",
      giftable: true
    }));
  });
});
