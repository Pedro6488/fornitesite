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
          <div><p className="eyebrow">ELIGE TU FAVORITO</p><h2>Encuentra lo que buscas</h2></div>
          <p>Descubre novedades, destacados y colecciones completas sin perderte entre cientos de objetos.</p>
        </div>
        <CatalogGrid items={items} />
      </section>
    </>
  );
}
