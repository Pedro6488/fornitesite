import { filterCatalogDiscovery, getCatalogCategory, groupCatalogByCollaboration, sortCatalog, UNGROUPED_COLLABORATION } from "../application/catalog-query";
import type { CatalogItem } from "../domain/catalog-item";
import { CatalogHeroStage } from "./catalog-hero-stage";

const SHOWCASE_SIZE = 5;
const SHOWCASE_CATEGORIES = new Set(["Atuendos", "Lotes"]);

/** Lo más nuevo y destacado, con atuendos y lotes al frente: son los que lucen a gran tamaño. */
function selectShowcase(items: readonly CatalogItem[]): readonly CatalogItem[] {
  const candidates = sortCatalog(filterCatalogDiscovery(items, "new"), "featured")
    .filter((item) => item.imageUrl && getCatalogCategory(item) !== "Música");
  return [
    ...candidates.filter((item) => SHOWCASE_CATEGORIES.has(getCatalogCategory(item))),
    ...candidates.filter((item) => !SHOWCASE_CATEGORIES.has(getCatalogCategory(item)))
  ].slice(0, SHOWCASE_SIZE);
}

export function CatalogHero({ items }: { items: readonly CatalogItem[] }) {
  return (
    <CatalogHeroStage
      showcase={selectShowcase(items)}
      stats={[
        { value: items.length, label: "objetos" },
        { value: filterCatalogDiscovery(items, "new").length, label: "novedades" },
        { value: groupCatalogByCollaboration(items).filter((group) => group.name !== UNGROUPED_COLLABORATION).length, label: "colecciones" }
      ]}
    />
  );
}
