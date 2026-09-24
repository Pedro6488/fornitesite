import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { getCatalogCategory } from "../application/catalog-query";
import { canPurchase, type CatalogItem } from "../domain/catalog-item";

export function CatalogCard({
  item,
  index,
}: {
  item: CatalogItem;
  index: number;
}) {
  const purchasable = canPurchase(item);
  const category = getCatalogCategory(item);
  const style = {
    "--card-order": Math.min(index, 12),
    "--motion-delay": `${-(index % 8) * 0.43}s`,
  } as CSSProperties;

  return (
    <article className="catalog-card" style={style}>
      <Link
        href={`/objetos/${encodeURIComponent(item.mainId)}`}
        aria-label={`Ver ${item.name}`}
        prefetch={false}
      >
        <div className="item-art" data-rarity={item.rarity} data-category={category}>
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              loading="lazy"
              sizes="(max-width: 560px) 50vw, (max-width: 960px) 33vw, 25vw"
            />
          ) : (
            <span className="item-fallback" aria-hidden="true">
              {item.name.slice(0, 1)}
            </span>
          )}
          <span className={`status-chip ${purchasable ? "available" : ""}`}>
            {purchasable ? "Disponible" : "Vista previa"}
          </span>
          <span className="card-arrow" aria-hidden="true">
            ↗
          </span>
          <span className="motion-chip" aria-hidden="true">
            <i /> En movimiento
          </span>
        </div>
        <div className="card-copy">
          <p className="item-meta">
            {category} · {item.rarity}
          </p>
          <h2>{item.name}</h2>
          <div className="prices">
            <span className="vbucks">
              ◉ {item.finalPriceVbucks.toLocaleString("es-MX")}
            </span>
            <strong>
              {item.priceMxn === null
                ? "Consultar"
                : formatMxn(item.priceMxn)}
            </strong>
          </div>
        </div>
      </Link>
    </article>
  );
}
