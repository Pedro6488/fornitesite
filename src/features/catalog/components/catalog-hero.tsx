import Image from "next/image";
import type { CatalogItem } from "../domain/catalog-item";

export function CatalogHero({ items }: { items: readonly CatalogItem[] }) {
  const previewItems = items.filter((item) => item.imageUrl).slice(0, 3);

  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">DESCUBRE LA TIENDA DE HOY</p>
        <h1>Encuentra tu próximo favorito.</h1>
        <p>Explora objetos, compara precios y encuentra justo lo que buscas sin perderte entre cientos de opciones.</p>
        <a className="hero-cta" href="#catalogo">Explorar catálogo <span aria-hidden="true">↓</span></a>
      </div>

      <div className="hero-showcase" aria-label={`${items.length} objetos disponibles`}>
        <div className="hero-glow" aria-hidden="true" />
        {previewItems.map((item, index) => (
          <div className={`hero-item hero-item-${index + 1}`} key={item.mainId}>
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
