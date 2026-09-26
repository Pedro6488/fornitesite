import { canPurchase, type CatalogItem } from "../domain/catalog-item";

export const CATALOG_CATEGORIES = [
  "Todos",
  "Atuendos",
  "Picos",
  "Gestos",
  "Lotes",
  "Mochilas",
  "Planeadores",
  "Envoltorios",
  "Otros"
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export const CATALOG_SORT_OPTIONS = [
  "newest",
  "featured",
  "price-asc",
  "price-desc"
] as const;

export type CatalogSort = (typeof CATALOG_SORT_OPTIONS)[number];

export type CatalogDiscoveryMode = "new" | "popular" | "all";
export type CatalogAvailability = "all" | "available" | "preview";
export type CatalogPriceRange = "all" | "under-80" | "80-120" | "120-160" | "over-160";

export type CatalogFacets = Readonly<{
  collaboration: string | null;
  availability: CatalogAvailability;
  priceRange: CatalogPriceRange;
  rarity: string | null;
}>;

export type CatalogCollaborationGroup = Readonly<{
  name: string;
  items: readonly CatalogItem[];
}>;

const UNGROUPED_COLLABORATION = "Otros objetos";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .trim();
}

export function getCatalogCategory(item: CatalogItem): CatalogCategory {
  const type = normalize(item.type);
  if (/(outfit|atuendo|skin)/.test(type)) return "Atuendos";
  if (/(pickaxe|pico|harvesting)/.test(type)) return "Picos";
  if (/(emote|gesto|emoji|spray)/.test(type)) return "Gestos";
  if (/(bundle|lote)/.test(type)) return "Lotes";
  if (/(backbling|back bling|mochila)/.test(type)) return "Mochilas";
  if (/(glider|planeador)/.test(type)) return "Planeadores";
  if (/(wrap|envoltorio)/.test(type)) return "Envoltorios";
  return "Otros";
}

export function filterCatalog(
  items: readonly CatalogItem[],
  query: string,
  category: CatalogCategory
): readonly CatalogItem[] {
  const normalizedQuery = normalize(query);

  return items.filter((item) => {
    if (category !== "Todos" && getCatalogCategory(item) !== category) return false;
    if (!normalizedQuery) return true;

    const searchableText = normalize([
      item.name,
      item.description,
      item.type,
      item.rarity,
      item.collaboration ?? ""
    ].join(" "));

    return normalizedQuery.split(/\s+/).every((term) => searchableText.includes(term));
  });
}

export function countCatalogCategories(
  items: readonly CatalogItem[]
): Readonly<Record<CatalogCategory, number>> {
  const counts = Object.fromEntries(
    CATALOG_CATEGORIES.map((category) => [category, category === "Todos" ? items.length : 0])
  ) as Record<CatalogCategory, number>;

  for (const item of items) counts[getCatalogCategory(item)] += 1;
  return counts;
}

function compareDateDescending(left?: string | null, right?: string | null): number {
  return (right ?? "").localeCompare(left ?? "");
}

function compareOptionalNumber(
  left?: number | null,
  right?: number | null,
  direction: "ascending" | "descending" = "ascending"
): number {
  const leftValue = left ?? (direction === "ascending" ? Number.MAX_SAFE_INTEGER : -1);
  const rightValue = right ?? (direction === "ascending" ? Number.MAX_SAFE_INTEGER : -1);
  return direction === "ascending" ? leftValue - rightValue : rightValue - leftValue;
}

function compareOfficialShopOrder(left: CatalogItem, right: CatalogItem): number {
  return compareOptionalNumber(left.shopLayoutIndex, right.shopLayoutIndex)
    || compareOptionalNumber(left.shopLayoutRank, right.shopLayoutRank, "descending")
    || left.name.localeCompare(right.name, "es-MX", { sensitivity: "base" });
}

function compareFeaturedShopOrder(left: CatalogItem, right: CatalogItem): number {
  return compareOptionalNumber(left.shopLayoutRank, right.shopLayoutRank, "descending")
    || compareOptionalNumber(left.shopLayoutIndex, right.shopLayoutIndex)
    || left.name.localeCompare(right.name, "es-MX", { sensitivity: "base" });
}

export function sortCatalog(
  items: readonly CatalogItem[],
  sort: CatalogSort
): readonly CatalogItem[] {
  return [...items].sort((left, right) => {
    if (sort === "price-asc") {
      return left.finalPriceVbucks - right.finalPriceVbucks || compareOfficialShopOrder(left, right);
    }
    if (sort === "price-desc") {
      return right.finalPriceVbucks - left.finalPriceVbucks || compareOfficialShopOrder(left, right);
    }
    if (sort === "featured") {
      return compareFeaturedShopOrder(left, right)
        || compareDateDescending(left.shopInDate, right.shopInDate);
    }

    return compareDateDescending(left.shopInDate, right.shopInDate)
      || compareOfficialShopOrder(left, right);
  });
}

function matchesPriceRange(item: CatalogItem, priceRange: CatalogPriceRange): boolean {
  if (priceRange === "all") return true;
  if (item.priceMxn === null) return false;
  if (priceRange === "under-80") return item.priceMxn <= 80;
  if (priceRange === "80-120") return item.priceMxn > 80 && item.priceMxn <= 120;
  if (priceRange === "120-160") return item.priceMxn > 120 && item.priceMxn <= 160;
  return item.priceMxn > 160;
}

export function filterCatalogFacets(
  items: readonly CatalogItem[],
  facets: CatalogFacets
): readonly CatalogItem[] {
  return items.filter((item) => {
    if (facets.collaboration && item.collaboration?.trim() !== facets.collaboration) return false;
    if (facets.rarity && item.rarity !== facets.rarity) return false;
    if (!matchesPriceRange(item, facets.priceRange)) return false;
    if (facets.availability === "available" && !canPurchase(item)) return false;
    if (facets.availability === "preview" && canPurchase(item)) return false;
    return true;
  });
}

export function getLatestShopDate(items: readonly CatalogItem[]): string | null {
  return items.reduce<string | null>((latest, item) => {
    if (!item.shopInDate) return latest;
    return !latest || item.shopInDate > latest ? item.shopInDate : latest;
  }, null);
}

export function filterCatalogDiscovery(
  items: readonly CatalogItem[],
  mode: CatalogDiscoveryMode,
  popularCollectionLimit = 6
): readonly CatalogItem[] {
  if (mode === "all") return items;
  if (mode === "new") {
    const latestShopDate = getLatestShopDate(items);
    return latestShopDate ? items.filter((item) => item.shopInDate === latestShopDate) : items;
  }

  return groupCatalogByCollaboration(sortCatalog(items, "featured"))
    .slice(0, popularCollectionLimit)
    .flatMap((group) => group.items);
}

export function groupCatalogByCollaboration(
  items: readonly CatalogItem[]
): readonly CatalogCollaborationGroup[] {
  const groups = new Map<string, CatalogItem[]>();

  for (const item of items) {
    const name = item.collaboration?.trim() || UNGROUPED_COLLABORATION;
    const group = groups.get(name) ?? [];
    group.push(item);
    groups.set(name, group);
  }

  return [...groups.entries()].map(([name, group]) => ({
    name,
    items: group.sort((left, right) => {
      const typeOrder = Number(getCatalogCategory(right) === "Lotes") - Number(getCatalogCategory(left) === "Lotes");
      return typeOrder || left.name.localeCompare(right.name, "es-MX", { sensitivity: "base" });
    })
  }));
}
