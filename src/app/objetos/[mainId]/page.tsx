import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { BackButton } from "@/shared/components/back-button";
import { ProductPurchaseActions } from "@/features/catalog/components/product-purchase-actions";
import { ItemPreview } from "@/features/catalog/components/item-preview";
import { CatalogCard } from "@/features/catalog/components/catalog-card";
import { ProductRail } from "@/features/catalog/components/product-rail";
import { canPurchase } from "@/features/catalog/domain/catalog-item";
import { getFortniteCosmoPreview } from "@/features/catalog/infrastructure/fortnite-cosmo-preview";

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ mainId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { mainId } = await params;
  const { from } = await searchParams;
  const fromAdmin = from === "/admin";
  const catalog = await getCatalogService();
  const items = await catalog.list();
  const item = items.find(
    (candidate) => candidate.mainId === decodeURIComponent(mainId),
  );
  if (!item) notFound();
  const preview = await getFortniteCosmoPreview(item.officialUrl, item.name);
  const discountPercentage =
    item.regularPriceVbucks > item.finalPriceVbucks
      ? Math.round((1 - item.finalPriceVbucks / item.regularPriceVbucks) * 100)
      : null;
  const collectionItems = item.collaboration
    ? items.filter(
        (candidate) =>
          candidate.mainId !== item.mainId &&
          candidate.collaboration === item.collaboration,
      )
    : [];
  const excludedIds = new Set([
    item.mainId,
    ...collectionItems.map((candidate) => candidate.mainId),
  ]);
  const relatedItems = items
    .filter(
      (candidate) =>
        !excludedIds.has(candidate.mainId) && canPurchase(candidate),
    )
    .sort(
      (left, right) =>
        Number(right.type === item.type) - Number(left.type === item.type),
    )
    .slice(0, 8);

  return (
    <>
      <section className="detail-shell">
        <div className="detail-visual">
          <div className="detail-navigation">
            <BackButton fallbackHref={fromAdmin ? "/admin" : "/#catalogo"} label={fromAdmin ? "Volver al panel" : "Volver al catálogo"} preferFallback={fromAdmin} />
          </div>
          <ItemPreview
            imageUrl={item.imageUrl}
            name={item.name}
            rarity={item.rarity}
            videoUrl={preview?.videoUrl ?? item.videoUrl ?? null}
          />
        </div>
        <div className="detail-copy">
          <p className="eyebrow">
            {item.collaboration ? `${item.collaboration} · ` : ""}
            {item.type} · {item.rarity}
          </p>
          <h1>{item.name}</h1>
          {item.description && <p>{item.description}</p>}
          <section
            className="detail-purchase-card"
            aria-label="Información de compra"
          >
            <div className="detail-purchase-heading">
              <div>
                <p className="eyebrow">COMPRA PROTEGIDA</p>
                <h2>Elige y agrégalo a tu carrito</h2>
              </div>
              {discountPercentage !== null && <span className="detail-promotion">Oferta -{discountPercentage}%</span>}
            </div>
            <div className="detail-price">
              <div>
                <small>Precio en paVos</small>
                <span className="detail-vbucks-price">
                  {discountPercentage !== null && (
                    <del>
                      ◉ {item.regularPriceVbucks.toLocaleString("es-MX")}
                    </del>
                  )}
                  <b>◉ {item.finalPriceVbucks.toLocaleString("es-MX")}</b>
                </span>
              </div>
              <div>
                <strong>
                  {item.priceMxn === null
                    ? "Consultar"
                    : formatMxn(item.priceMxn)}
                  {item.priceMxn !== null && <em> MXN</em>}
                </strong>
              </div>
            </div>
          </section>
          <ProductPurchaseActions item={item} />
        </div>
      </section>
      <div className="detail-discovery">
        {collectionItems.length > 0 && (
          <section
            className="detail-discovery-section"
            aria-labelledby="collection-title"
          >
            <header>
              <div>
                <p className="eyebrow">DE LA MISMA COLECCIÓN</p>
                <h2 id="collection-title">Completa {item.collaboration}</h2>
              </div>
              <span>
                {collectionItems.length}{" "}
                {collectionItems.length === 1 ? "objeto" : "objetos"}
              </span>
            </header>
            <ProductRail label="objetos de la misma colección">
              {collectionItems.map((candidate, index) => (
                <CatalogCard
                  key={candidate.mainId}
                  item={candidate}
                  index={index}
                />
              ))}
            </ProductRail>
          </section>
        )}
        {relatedItems.length > 0 && (
          <section
            className="detail-discovery-section"
            aria-labelledby="related-title"
          >
            <header>
              <div>
                <p className="eyebrow">SIGUE EXPLORANDO</p>
                <h2 id="related-title">También te puede gustar</h2>
              </div>
              <Link href="/#catalogo">
                Ver todo <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </header>
            <ProductRail label="objetos recomendados">
              {relatedItems.map((candidate, index) => (
                <CatalogCard
                  key={candidate.mainId}
                  item={candidate}
                  index={index}
                />
              ))}
            </ProductRail>
          </section>
        )}
      </div>
    </>
  );
}
