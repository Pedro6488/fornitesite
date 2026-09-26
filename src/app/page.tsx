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
          <div><p className="eyebrow">ELIGE TU FAVORITO</p><h2>Lo nuevo aparece primero</h2></div>
          <p>Explora recién llegados, populares y categorías sin perderte entre cientos de objetos.</p>
        </div>
        <CatalogGrid items={items} />
      </section>
    </>
  );
}
