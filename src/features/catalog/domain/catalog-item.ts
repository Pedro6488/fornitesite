export type CatalogItem = Readonly<{
  mainId: string;
  offerId: string | null;
  name: string;
  description: string;
  imageUrl: string | null;
  type: string;
  rarity: string;
  regularPriceVbucks: number;
  finalPriceVbucks: number;
  priceMxn: number | null;
  giftable: boolean;
  availableUntil: string | null;
  featured: boolean;
}>;

export interface CatalogProvider {
  getCurrentCatalog(): Promise<readonly CatalogItem[]>;
}

export function canPurchase(item: CatalogItem): boolean {
  return Boolean(item.offerId && item.giftable && item.priceMxn !== null);
}

export function getCatalogTransitionName(mainId: string): string {
  return `catalog-${mainId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
