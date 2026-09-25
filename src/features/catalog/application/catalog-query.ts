import type { CatalogItem } from "../domain/catalog-item";

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
      item.rarity
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

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === UNGROUPED_COLLABORATION) return 1;
      if (right === UNGROUPED_COLLABORATION) return -1;
      return left.localeCompare(right, "es-MX", { sensitivity: "base" });
    })
    .map(([name, group]) => ({
      name,
      items: group.sort((left, right) => {
        const typeOrder = Number(getCatalogCategory(right) === "Lotes") - Number(getCatalogCategory(left) === "Lotes");
        return typeOrder || left.name.localeCompare(right.name, "es-MX", { sensitivity: "base" });
      })
    }));
}
