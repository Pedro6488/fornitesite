import { notFound } from "next/navigation";
import Link from "next/link";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { BackButton } from "@/shared/components/back-button";
import { FavoriteButton } from "@/features/catalog/components/favorite-button";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import { ItemPreview } from "@/features/catalog/components/item-preview";
import { getFortniteCosmoPreview } from "@/features/catalog/infrastructure/fortnite-cosmo-preview";

export default async function ItemPage({ params }: { params: Promise<{ mainId: string }> }) {
  const { mainId } = await params;
  const item = await (await getCatalogService()).find(decodeURIComponent(mainId));
  if (!item) notFound();
  const preview = await getFortniteCosmoPreview(item.officialUrl, item.name);

  return <section className="detail-shell">
    <div className="detail-navigation"><BackButton /><Link className="detail-skip" href="/#catalogo">No agregar</Link></div>
    <ItemPreview imageUrl={item.imageUrl} name={item.name} rarity={item.rarity} videoUrl={preview?.videoUrl ?? item.videoUrl ?? null} />
    <div className="detail-copy">
      <p className="eyebrow">{item.type} · {item.rarity}</p><h1>{item.name}</h1>
      <FavoriteButton itemId={item.mainId} itemName={item.name} variant="detail" />
      {item.description && <p>{item.description}</p>}
      <div className="detail-price"><div><small>Precio en paVos</small><span>◉ {item.finalPriceVbucks.toLocaleString("es-MX")}</span></div><div><small>Tu precio</small><strong>{item.priceMxn === null ? "Consultar" : formatMxn(item.priceMxn)}</strong></div></div>
      <div className="detail-assurances"><span>✓ Precio claro</span><span>✓ Seguimiento</span></div>
      <AddToCartButton item={item} redirectTo="/#catalogo" />
    </div>
  </section>;
}
