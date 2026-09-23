import Image from "next/image";
import Link from "next/link";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { canPurchase, type CatalogItem } from "../domain/catalog-item";

export function CatalogCard({ item, priority = false }: { item: CatalogItem; priority?: boolean }) {
  const purchasable = canPurchase(item);

  return (
    <article className={`catalog-card ${priority ? "catalog-card--featured" : ""}`}>
      <Link href={`/objetos/${encodeURIComponent(item.mainId)}`} aria-label={`Ver ${item.name}`}>
        <div className="item-art" data-rarity={item.rarity}>
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={item.name} fill sizes={priority ? "(max-width: 800px) 100vw, 65vw" : "(max-width: 800px) 50vw, 25vw"} />
          ) : (
            <span aria-hidden="true">{item.name.slice(0, 1)}</span>
          )}
          {!purchasable && <span className="status-chip">Solo informativo</span>}
        </div>
        <div className="card-copy">
          <p className="item-meta">{item.type} · {item.rarity}</p>
          <h2>{item.name}</h2>
          <div className="prices">
            <span className="vbucks">◉ {item.finalPriceVbucks.toLocaleString("es-MX")}</span>
            <strong>{item.priceMxn === null ? "Sin precio" : formatMxn(item.priceMxn)}</strong>
          </div>
        </div>
      </Link>
    </article>
  );
}
