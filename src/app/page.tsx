import { CatalogGrid } from "@/features/catalog/components/catalog-grid";
import { CatalogHero } from "@/features/catalog/components/catalog-hero";
import { getCatalogService } from "@/features/catalog/server/get-catalog";

export default async function HomePage() {
  const catalog = await getCatalogService();
  const items = await catalog.list();

  return (
    <>
      <CatalogHero items={items} />
      <section className="shop-section" id="catalogo">
        <div className="section-heading">
          <div><p className="eyebrow">CATÁLOGO</p><h2>Todo en un solo lugar</h2></div>
          <p>Busca por nombre o explora por categoría.</p>
        </div>
        <CatalogGrid items={items} />
      </section>
    </>
  );
}
