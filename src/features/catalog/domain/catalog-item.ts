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

export function isCatalogItemDisplayable(item: CatalogItem): boolean {
  const name = item.name.trim().toLocaleLowerCase("es-MX");
  const type = item.type.trim().toLocaleLowerCase("es-MX");

  return Boolean(
    item.mainId.trim() &&
    item.imageUrl?.trim() &&
    item.finalPriceVbucks > 0 &&
    name &&
    !["objeto sin nombre", "unnamed item", "unknown"].includes(name) &&
    type &&
    !["objeto", "object", "unknown"].includes(type)
  );
}

export function getCatalogTransitionName(mainId: string): string {
  return `catalog-${mainId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
