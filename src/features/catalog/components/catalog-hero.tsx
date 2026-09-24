import Image from "next/image";
import { getCatalogCategory } from "../application/catalog-query";
import type { CatalogItem } from "../domain/catalog-item";

export function CatalogHero({ items }: { items: readonly CatalogItem[] }) {
  const previewItems = items.filter((item) => item.imageUrl).slice(0, 3);

  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">TU TIENDA, SIN COMPLICACIONES</p>
        <h1>
          Tu próximo favorito <span>está aquí.</span>
        </h1>
        <p>
          Descubre el catálogo vigente, compara el precio en paVos y MXN, y
          valida la disponibilidad antes de pagar.
        </p>
        <div className="hero-actions">
          <a className="hero-cta" href="#catalogo">
            Ver objetos disponibles <span aria-hidden="true">↓</span>
          </a>
        </div>
        <ul className="hero-benefits" aria-label="Beneficios de la tienda">
          <li>
            <span aria-hidden="true">✓</span> Catálogo vigente
          </li>
          <li>
            <span aria-hidden="true">✓</span> Precios claros
          </li>
          <li>
            <span aria-hidden="true">✓</span> Validación previa
          </li>
        </ul>
      </div>

      <div
        className="hero-showcase"
        aria-label={`${items.length} objetos disponibles`}
      >
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-live">
          <span aria-hidden="true" /> Catálogo activo
        </div>
        {previewItems.map((item, index) => (
          <div
            className={`hero-item hero-item-${index + 1}`}
            data-category={getCatalogCategory(item)}
            key={item.mainId}
          >
            {item.imageUrl && (
              <Image
                src={item.imageUrl}
                alt=""
                fill
                priority={index === 0}
                loading={index === 0 ? "eager" : "lazy"}
                sizes="(max-width: 800px) 45vw, 22rem"
              />
            )}
          </div>
        ))}
        <div className="hero-count">
          <strong>{items.length}</strong>
          <span>objetos listos para explorar</span>
        </div>
      </div>
    </section>
  );
}
