import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Timer } from "lucide-react";
import { RegionalPrice } from "@/features/pricing/components/regional-price";
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
  const detailHref = `/objetos/${encodeURIComponent(item.mainId)}`;
  const discountPercentage = item.regularPriceVbucks > item.finalPriceVbucks
    ? Math.round((1 - item.finalPriceVbucks / item.regularPriceVbucks) * 100)
    : null;
  const style = {
    "--card-order": Math.min(index, 12),
  } as CSSProperties;

  return (
    <article className="catalog-card" data-rarity={item.rarity} style={style}>
      <Link href={detailHref} aria-label={`Ver ${item.name}`} prefetch={false}>
        <div className="item-art" data-rarity={item.rarity}>
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              loading="lazy"
              sizes="(max-width: 639px) 50vw, (max-width: 999px) 33vw, (max-width: 1279px) 25vw, 280px"
            />
          ) : (
            <span className="item-fallback" aria-hidden="true">
              {item.name.slice(0, 1)}
            </span>
          )}
          {discountPercentage !== null && <span className="catalog-promotion-chip">-{discountPercentage}%</span>}
          {/* Las pistas de música no tienen rareza en la tienda. */}
          {category !== "Música" && <span className="catalog-rarity-tag">{item.rarity}</span>}
        </div>
        <div className="card-copy">
          <p className="item-meta">{item.type}</p>
          <h2>{item.name}</h2>
        </div>
        <div className="catalog-card-offer">
          <div className="catalog-card-offer-prices">
            <strong className="catalog-card-price">
              <RegionalPrice vbucks={item.finalPriceVbucks} mxnPrice={item.priceMxn} />
            </strong>
            <span className="catalog-card-vbucks">
              {discountPercentage !== null && <del>{item.regularPriceVbucks.toLocaleString("es-MX")}</del>}
              <span>◉ {item.finalPriceVbucks.toLocaleString("es-MX")}</span>
            </span>
          </div>
          {purchasable && item.availableUntil && <p className="catalog-price-assurance"><Timer aria-hidden="true" size={13} />Hasta el {new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(item.availableUntil))}</p>}
        </div>
      </Link>
      <div className="catalog-card-actions">
        {purchasable ? (
          <>
            <AddToCartButton item={item} compact />
            <Link className="catalog-detail-link catalog-detail-icon" href={detailHref} prefetch={false} aria-label={`Ver detalle de ${item.name}`}>
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          </>
        ) : (
          <Link className="catalog-detail-link catalog-detail-wide" href={detailHref} prefetch={false}>
            Ver detalle <ChevronRight aria-hidden="true" size={14} />
          </Link>
        )}
      </div>
      <FavoriteButton itemId={item.mainId} itemName={item.name} initialFavorite={initialFavorite} />
    </article>
  );
}
