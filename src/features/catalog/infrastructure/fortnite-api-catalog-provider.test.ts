import { afterEach, describe, expect, it, vi } from "vitest";
import { FortniteApiCatalogProvider } from "./fortnite-api-catalog-provider";

afterEach(() => vi.unstubAllGlobals());

describe("FortniteApiCatalogProvider", () => {
  it("conserva un lote aunque su bundle.id esté vacío y comparta objeto con una oferta individual", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        entries: [{
          offerId: "bundle-offer",
          finalPrice: 3_400,
          regularPrice: 6_800,
          bundle: {
            name: "Madison Beer Bundle",
            image: "https://fortnite-api.com/madison.png"
          },
          brItems: [{
            id: "CID_MADISON",
            name: "Make You Mine Madison",
            type: { displayValue: "Outfit" },
            rarity: { displayValue: "Epic" },
            images: { featured: "https://fortnite-api.com/madison-item.png" }
          }]
        }]
      }
    }), { status: 200 })));

    const [item] = await new FortniteApiCatalogProvider("https://fortnite-api.com/v2").getCurrentCatalog();

    expect(item).toEqual(expect.objectContaining({
      mainId: "bundle-offer",
      offerId: "bundle-offer",
      name: "Madison Beer Bundle",
      type: "Lote",
      imageUrl: "https://fortnite-api.com/madison.png"
    }));
  });
});
