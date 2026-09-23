import { CatalogGrid } from "@/features/catalog/components/catalog-grid";
import { getCatalogService } from "@/features/catalog/server/get-catalog";

export default async function HomePage() {
  const catalog = await getCatalogService();
  const items = await catalog.list();

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">TIENDA ACTUALIZADA · 18:00 CDMX</p>
          <h1>Elige. Valida. Recíbelo.</h1>
          <p>Consulta la tienda vigente, valida tu cuenta y compra con precios claros en paVos y pesos mexicanos.</p>
        </div>
        <div className="hero-stat"><strong>{items.length}</strong><span>ofertas vigentes</span></div>
      </section>
      <section className="shop-section">
        <div className="section-heading">
          <div><p className="eyebrow">HOY EN LA TIENDA</p><h2>Objetos disponibles</h2></div>
          <p>Los objetos sin coincidencia operativa se muestran sin compra.</p>
        </div>
        <CatalogGrid items={items} />
      </section>
    </>
  );
}
