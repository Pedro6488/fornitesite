import { notFound } from "next/navigation";
import Link from "next/link";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { canPurchase } from "@/features/catalog/domain/catalog-item";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { BackButton } from "@/shared/components/back-button";
import { FavoriteButton } from "@/features/catalog/components/favorite-button";
import { ItemPreview } from "@/features/catalog/components/item-preview";
import { getFortniteCosmoPreview } from "@/features/catalog/infrastructure/fortnite-cosmo-preview";

export default async function ItemPage({ params }: { params: Promise<{ mainId: string }> }) {
  const { mainId } = await params;
  const catalog = await getCatalogService();
  const item = await catalog.find(decodeURIComponent(mainId));
  if (!item) notFound();
  const purchasable = canPurchase(item);
  const preview = await getFortniteCosmoPreview(item.officialUrl, item.name);

  return (
    <section className="detail-shell">
      <div className="detail-navigation"><BackButton /></div>
      <ItemPreview imageUrl={item.imageUrl} name={item.name} rarity={item.rarity} videoUrl={preview?.videoUrl ?? item.videoUrl ?? null} />
      <div className="detail-copy">
        <p className="eyebrow">{item.type} · {item.rarity}</p>
        <h1>{item.name}</h1>
        <FavoriteButton itemId={item.mainId} itemName={item.name} variant="detail" />
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
