import { canPurchase, type CatalogItem } from "@/features/catalog/domain/catalog-item";

export type CartAvailabilityEntry = Readonly<{
  itemId: string;
  item: CatalogItem | null;
  available: boolean;
}>;

export function resolveCartAvailability(
  itemIds: readonly string[],
  catalogItems: readonly CatalogItem[],
  now: number = Date.now()
): readonly CartAvailabilityEntry[] {
  const catalogById = new Map(catalogItems.map((item) => [item.mainId, item]));
  return itemIds.map((itemId) => {
    const item = catalogById.get(itemId) ?? null;
    return { itemId, item, available: Boolean(item && canPurchase(item, now)) };
  });
}
