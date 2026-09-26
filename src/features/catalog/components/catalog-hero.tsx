import Image from "next/image";
import { sortCatalog } from "../application/catalog-query";
import type { CatalogItem } from "../domain/catalog-item";

export function CatalogHero({ items }: { items: readonly CatalogItem[] }) {
  const previewItems = sortCatalog(items, "newest").filter((item) => item.imageUrl).slice(0, 3);

  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">LO NUEVO YA ESTÁ AQUÍ</p>
        <h1>
          Elige. Valida. <span>Recíbelo.</span>
        </h1>
        <p>
          Encuentra tu objeto, conoce el precio en pesos y confirma quién puede
          entregártelo antes de pagar.
        </p>
        <div className="hero-actions">
          <a className="hero-cta" href="#catalogo">
            Comprar ahora <span aria-hidden="true">↓</span>
          </a>
        </div>
        <ul className="hero-benefits" aria-label="Beneficios de la tienda">
          <li>
            <span aria-hidden="true">1</span> Elige tu objeto
          </li>
          <li>
            <span aria-hidden="true">2</span> Validamos disponibilidad
          </li>
          <li>
            <span aria-hidden="true">3</span> Recibe seguimiento
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
          <span>objetos disponibles</span>
        </div>
      </div>
    </section>
  );
}
