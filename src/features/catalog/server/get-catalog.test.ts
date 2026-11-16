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
      "https://fortnite-api.com/v2/shop?language=es-419",
      { next: { revalidate: 300 } }
    );
    expect(item).toEqual(expect.objectContaining({
      mainId: "CID_REAL",
      name: "Objeto real",
      offerId: "fortnite-offer",
      giftable: true,
      priceMxn: 113
    }));
  });

  it("no consulta FN Shop aunque la entrega automática esté encendida", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fortniteResponse), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("FULFILLMENT_MODE", "fnshop");
    vi.stubEnv("FNSHOP_API_KEY", "secret");

    const [item] = await createCatalogService({}).list();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("fnitem.shop");
    expect(item).toEqual(expect.objectContaining({ offerId: "fortnite-offer", giftable: true }));
    vi.unstubAllEnvs();
  });
});
