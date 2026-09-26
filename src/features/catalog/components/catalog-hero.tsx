import Image from "next/image";
import Link from "next/link";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { filterCatalogDiscovery, sortCatalog } from "../application/catalog-query";
import type { CatalogItem } from "../domain/catalog-item";

export function CatalogHero({ items }: { items: readonly CatalogItem[] }) {
  const newestItems = filterCatalogDiscovery(items, "new");
  const previewItems = sortCatalog(newestItems, "newest")
    .filter((item) => item.imageUrl)
    .slice(0, 3);

  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">LO NUEVO DE HOY</p>
        <h1>
          Elige. Valida. <span>Recíbelo.</span>
        </h1>
        <p>
          Explora la tienda, conoce el precio en pesos y confirma disponibilidad
          antes de pagar.
        </p>
        <div className="hero-actions">
          <a className="hero-cta" href="#catalogo">
            Comprar ahora <span aria-hidden="true">↓</span>
          </a>
        </div>
        <ul className="hero-benefits" aria-label="Beneficios de la tienda">
          <li>
            <span aria-hidden="true">1</span> Elige
          </li>
          <li>
            <span aria-hidden="true">2</span> Confirmamos
          </li>
          <li>
            <span aria-hidden="true">3</span> Recíbelo
          </li>
        </ul>
      </div>

      <div
        className="hero-showcase"
        aria-label={`${items.length} objetos disponibles`}
      >
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-live">
          <span aria-hidden="true" /> Recién llegado
        </div>
        {previewItems.map((item, index) => (
          <div
            className={`hero-item hero-item-${index + 1}`}
            key={item.mainId}
          >
            <Link
              href={`/objetos/${encodeURIComponent(item.mainId)}`}
              aria-label={`Ver ${item.name}, ${item.finalPriceVbucks.toLocaleString("es-MX")} paVos`}
              prefetch={false}
            >
              {item.imageUrl && (
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  priority={index === 0}
                  loading={index === 0 ? "eager" : "lazy"}
                  sizes="(max-width: 800px) 45vw, 22rem"
                />
              )}
              <span className="hero-item-info">
                <strong>{item.name}</strong>
                <span>
                  <small>◉ {item.finalPriceVbucks.toLocaleString("es-MX")}</small>
                  <b>{item.priceMxn === null ? "Consultar" : formatMxn(item.priceMxn)}</b>
                </span>
              </span>
            </Link>
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
