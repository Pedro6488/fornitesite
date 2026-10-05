import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { getCatalogCategory } from "../application/catalog-query";
import { canPurchase, type CatalogItem } from "../domain/catalog-item";
import { FavoriteButton } from "./favorite-button";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";

export function CatalogCard({
  item,
  index,
  initialFavorite = false,
}: {
  item: CatalogItem;
  index: number;
  initialFavorite?: boolean;
}) {
  const purchasable = canPurchase(item);
  const category = getCatalogCategory(item);
  const discountPercentage = item.regularPriceVbucks > item.finalPriceVbucks
    ? Math.round((1 - item.finalPriceVbucks / item.regularPriceVbucks) * 100)
    : null;
  const style = {
    "--card-order": Math.min(index, 12),
  } as CSSProperties;

  return (
    <article className="catalog-card" style={style}>
      <Link
        href={`/objetos/${encodeURIComponent(item.mainId)}`}
        aria-label={`Ver ${item.name}`}
        prefetch={false}
      >
        <div className="item-art" data-rarity={item.rarity}>
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
          {discountPercentage !== null && <span className="catalog-promotion-chip">-{discountPercentage}%</span>}
          <div className="catalog-card-offer">
            <div className="catalog-card-offer-prices">
              <div className="catalog-card-vbucks">
                <span>Precio en paVos</span>
                <div>
                  {discountPercentage !== null && <del>◉ {item.regularPriceVbucks.toLocaleString("es-MX")}</del>}
                  <strong>◉ {item.finalPriceVbucks.toLocaleString("es-MX")}</strong>
                </div>
              </div>
              <div className="catalog-card-price">
                <strong>
                  {item.priceMxn === null
                    ? "Consultar"
                    : formatMxn(item.priceMxn)}
                  {item.priceMxn !== null && <small>MXN</small>}
                </strong>
              </div>
            </div>
            {purchasable && item.availableUntil && <p className="catalog-price-assurance"><CalendarClock aria-hidden="true" size={13} />Vigente hasta {new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(item.availableUntil))}</p>}
          </div>
        </div>
        <div className="card-copy">
          <p className="item-meta">
            {item.collaboration || category} · {item.rarity}
          </p>
          <h2>{item.name}</h2>
        </div>
      </Link>
      <div className="catalog-card-actions">
        {purchasable ? <><AddToCartButton item={item} compact /><Link className="catalog-detail-link" href={`/objetos/${encodeURIComponent(item.mainId)}`} prefetch={false}>Ver detalle <ChevronRight aria-hidden="true" size={14} /></Link></> : <Link className="catalog-detail-link catalog-detail-wide" href={`/objetos/${encodeURIComponent(item.mainId)}`} prefetch={false}>Ver detalle <ChevronRight aria-hidden="true" size={14} /></Link>}
      </div>
      <FavoriteButton itemId={item.mainId} itemName={item.name} initialFavorite={initialFavorite} />
    </article>
  );
}
