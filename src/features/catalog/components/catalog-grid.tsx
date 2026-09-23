import type { CatalogItem } from "../domain/catalog-item";
import { CatalogCard } from "./catalog-card";

export function CatalogGrid({ items }: { items: readonly CatalogItem[] }) {
  const [featured, ...rest] = items;
  if (!featured) return <p>No hay ofertas disponibles.</p>;

  return (
    <div className="catalog-layout">
      <CatalogCard item={featured} priority />
      <div className="catalog-grid">
        {rest.map((item) => <CatalogCard key={item.mainId} item={item} />)}
      </div>
    </div>
  );
}
