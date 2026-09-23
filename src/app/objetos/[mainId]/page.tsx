import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { canPurchase } from "@/features/catalog/domain/catalog-item";
import { formatMxn } from "@/features/pricing/domain/price-calculator";

export default async function ItemPage({ params }: { params: Promise<{ mainId: string }> }) {
  const { mainId } = await params;
  const catalog = await getCatalogService();
  const item = await catalog.find(decodeURIComponent(mainId));
  if (!item) notFound();

  return (
    <section className="detail-shell">
      <div className="detail-art item-art" data-rarity={item.rarity}>
        {item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill priority sizes="(max-width: 800px) 100vw, 50vw" /> : <span>{item.name.slice(0, 1)}</span>}
      </div>
      <div className="detail-copy">
        <p className="eyebrow">{item.type} · {item.rarity}</p>
        <h1>{item.name}</h1>
        <p>{item.description}</p>
        <div className="detail-price">
          <span>◉ {item.finalPriceVbucks.toLocaleString("es-MX")} paVos</span>
          <strong>{item.priceMxn === null ? "Sin precio" : formatMxn(item.priceMxn)}</strong>
        </div>
        {item.availableUntil && <p className="availability">Disponible hasta {new Date(item.availableUntil).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</p>}
        {canPurchase(item) ? (
          <Link className="primary-button" href={`/validar?item=${encodeURIComponent(item.mainId)}`}>Validar mi cuenta</Link>
        ) : (
          <button className="primary-button" disabled>No disponible para compra</button>
        )}
      </div>
    </section>
  );
}
