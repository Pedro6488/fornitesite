import { canPurchase, type CatalogItem } from "@/features/catalog/domain/catalog-item";

const DEFAULT_LIMIT = 8;

/** Objetos para seguir comprando: primero la misma colección, luego el mismo tipo. */
export function suggestForCart(
  items: readonly CatalogItem[],
  cartItemIds: readonly string[],
  limit: number = DEFAULT_LIMIT,
): readonly CatalogItem[] {
  const inCart = new Set(cartItemIds);
  const selected = items.filter((item) => inCart.has(item.mainId));
  const collections = new Set(selected.flatMap((item) => (item.collaboration ? [item.collaboration] : [])));
  const types = new Set(selected.map((item) => item.type));
  const score = (item: CatalogItem) =>
    (item.collaboration && collections.has(item.collaboration) ? 2 : 0) + (types.has(item.type) ? 1 : 0);

  return items
    .filter((item) => !inCart.has(item.mainId) && canPurchase(item))
    .map((item, position) => ({ item, position, score: score(item) }))
    .sort((left, right) => right.score - left.score || left.position - right.position)
    .slice(0, limit)
    .map(({ item }) => item);
}
