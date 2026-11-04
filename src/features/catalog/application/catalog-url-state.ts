import {
  CATALOG_CATEGORIES,
  CATALOG_SORT_OPTIONS,
  type CatalogAvailability,
  type CatalogCategory,
  type CatalogDiscoveryMode,
  type CatalogPriceRange,
  type CatalogSort
} from "./catalog-query";

export const CATALOG_PAGE_SIZE = 48;
const MAX_VISIBLE_COUNT = 2_000;

export type CatalogView = "items" | "collections";

export type CatalogUrlState = Readonly<{
  view: CatalogView;
  mode: CatalogDiscoveryMode;
  sort: CatalogSort;
  category: CatalogCategory;
  collaboration: string | null;
  availability: CatalogAvailability;
  priceRange: CatalogPriceRange;
  rarity: string | null;
  query: string;
  visibleCount: number;
}>;

const PRICE_RANGES: readonly CatalogPriceRange[] = ["all", "under-80", "80-120", "120-160", "over-160"];
const AVAILABILITIES: readonly CatalogAvailability[] = ["all", "available", "preview"];

export function defaultCatalogSort(mode: CatalogDiscoveryMode): CatalogSort {
  return mode === "popular" ? "featured" : "newest";
}

function oneOf<T extends string>(options: readonly T[], value: string | null, fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

/** La URL la puede escribir cualquiera: todo valor desconocido cae en su valor por defecto. */
export function parseCatalogUrlState(search: string): CatalogUrlState {
  const params = new URLSearchParams(search);
  const scope = params.get("vista");
  const mode: CatalogDiscoveryMode = scope === "novedades" ? "new" : scope === "populares" ? "popular" : "all";
  const visibleCount = Number.parseInt(params.get("mostrar") ?? "", 10);

  return {
    view: scope === "colecciones" ? "collections" : "items",
    mode,
    sort: oneOf(CATALOG_SORT_OPTIONS, params.get("orden"), defaultCatalogSort(mode)),
    category: oneOf(CATALOG_CATEGORIES, params.get("categoria"), "Todos"),
    collaboration: params.get("coleccion") || null,
    availability: oneOf(AVAILABILITIES, params.get("disponibilidad"), "all"),
    priceRange: oneOf(PRICE_RANGES, params.get("precio"), "all"),
    rarity: params.get("rareza") || null,
    query: params.get("q") ?? "",
    visibleCount: visibleCount > CATALOG_PAGE_SIZE ? Math.min(visibleCount, MAX_VISIBLE_COUNT) : CATALOG_PAGE_SIZE
  };
}

export function serializeCatalogUrlState(state: CatalogUrlState): string {
  const params = new URLSearchParams();
  const set = (name: string, value: string | null, fallback: string | null = null) => {
    if (value && value !== fallback) params.set(name, value);
  };

  if (state.view === "collections") {
    params.set("vista", "colecciones");
    set("q", state.query.trim());
  } else {
    set("vista", state.mode === "new" ? "novedades" : state.mode === "popular" ? "populares" : null);
    set("q", state.query.trim());
    set("categoria", state.category, "Todos");
    set("coleccion", state.collaboration);
    set("orden", state.sort, defaultCatalogSort(state.mode));
    set("precio", state.priceRange, "all");
    set("disponibilidad", state.availability, "all");
    set("rareza", state.rarity);
    if (state.visibleCount > CATALOG_PAGE_SIZE) params.set("mostrar", String(state.visibleCount));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}
