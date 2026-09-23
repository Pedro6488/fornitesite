import type { CatalogItem, CatalogProvider } from "../domain/catalog-item";

type FnShopItem = {
  mainId?: string;
  offerId?: string;
  name?: string;
  description?: string;
  image?: string;
  type?: string;
  rarity?: string;
  regularPrice?: number;
  price?: number;
  giftable?: boolean;
  outDate?: string;
};

export class FnShopCatalogProvider implements CatalogProvider {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async getCurrentCatalog(): Promise<readonly CatalogItem[]> {
    const response = await fetch(`${this.baseUrl}/shop`, {
      headers: { "X-Api-Key": this.apiKey },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`FN Shop respondió ${response.status}.`);
    const payload = (await response.json()) as { items?: FnShopItem[]; shop?: FnShopItem[] };
    const items = payload.items ?? payload.shop ?? [];

    return items.flatMap((item, index): CatalogItem[] => {
      if (!item.mainId || !item.price) return [];
      return [{
        mainId: item.mainId,
        offerId: item.offerId ?? null,
        name: item.name ?? "Objeto sin nombre",
        description: item.description ?? "",
        imageUrl: item.image ?? null,
        type: item.type ?? "Objeto",
        rarity: item.rarity ?? "Común",
        regularPriceVbucks: item.regularPrice ?? item.price,
        finalPriceVbucks: item.price,
        priceMxn: null,
        giftable: item.giftable ?? false,
        availableUntil: item.outDate ?? null,
        featured: index === 0
      }];
    });
  }
}
