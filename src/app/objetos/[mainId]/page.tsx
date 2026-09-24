import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { canPurchase, getCatalogTransitionName } from "@/features/catalog/domain/catalog-item";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { BackButton } from "@/shared/components/back-button";

export default async function ItemPage({ params }: { params: Promise<{ mainId: string }> }) {
  const { mainId } = await params;
  const catalog = await getCatalogService();
  const item = await catalog.find(decodeURIComponent(mainId));
  if (!item) notFound();
  const purchasable = canPurchase(item);

  return (
    <section className="detail-shell">
      <div className="detail-navigation"><BackButton /></div>
      <ViewTransition name={getCatalogTransitionName(item.mainId)} share="catalog-item">
        <div className="detail-art item-art" data-rarity={item.rarity}>
          {item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill priority sizes="(max-width: 800px) 100vw, 50vw" /> : <span className="item-fallback">{item.name.slice(0, 1)}</span>}
          <span className="detail-motion-chip"><i aria-hidden="true" /> Vista dinámica</span>
          <span className="detail-orbit detail-orbit-one" aria-hidden="true" />
          <span className="detail-orbit detail-orbit-two" aria-hidden="true" />
        </div>
      </ViewTransition>
      <div className="detail-copy">
        <p className="eyebrow">{item.type} · {item.rarity}</p>
        <h1>{item.name}</h1>
        {item.description && <p>{item.description}</p>}
        <div className="detail-price">
          <div><small>Precio en paVos</small><span>◉ {item.finalPriceVbucks.toLocaleString("es-MX")}</span></div>
          <div><small>Tu precio</small><strong>{item.priceMxn === null ? "Consultar" : formatMxn(item.priceMxn)}</strong></div>
        </div>
        <div className="detail-assurances" aria-label="Información de compra">
          <span>✓ Precio claro</span>
          <span>✓ Validación previa</span>
          <span>✓ Seguimiento</span>
        </div>
        {item.availableUntil && <p className="availability">Disponible hasta {new Date(item.availableUntil).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</p>}
        {purchasable ? (
          <Link className="primary-button detail-cta" href={`/validar?item=${encodeURIComponent(item.mainId)}`}>Validar disponibilidad <span aria-hidden="true">→</span></Link>
        ) : (
          <div className="detail-unavailable">
            <strong>Compra no disponible por ahora</strong>
            <p>Puedes explorar este objeto, pero todavía no contamos con un agente disponible para entregarlo.</p>
            <Link href="/#catalogo">Seguir explorando</Link>
          </div>
        )}
      </div>
    </section>
  );
}
