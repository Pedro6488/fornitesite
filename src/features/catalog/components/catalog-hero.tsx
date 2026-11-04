import Image from "next/image";
import { StorefrontLink as Link } from "@/features/storefront/components/storefront-link";
import { RegionalPrice } from "@/features/pricing/components/regional-price";
import { filterCatalogDiscovery, sortCatalog } from "../application/catalog-query";
import type { CatalogItem } from "../domain/catalog-item";
import styles from "./catalog-hero.module.css";

export function CatalogHero({ items }: { items: readonly CatalogItem[] }) {
  const previewItems = sortCatalog(filterCatalogDiscovery(items, "new"), "newest")
    .filter((item) => item.imageUrl).slice(0, 3);
  return <section className={styles.hero}>
    <div className={styles.copy}><p className={styles.eyebrow}>FORTNITE / OBJETOS DE LA TIENDA</p><h1>ELIGE TU<br /><span>SIGUIENTE LOOK.</span></h1><p>Tu estilo, dentro y fuera del bus. Confirma el precio,<br className={styles.desktopBreak} /> la disponibilidad y tu ID antes de pagar.</p><span className={styles.count}>{items.length.toLocaleString("es-MX")} objetos en el catálogo</span></div>
    {previewItems.length > 0 && <div className={styles.preview} aria-label="Objetos recién llegados">{previewItems.map((item, index) => <Link key={item.mainId} href={`/objetos/${encodeURIComponent(item.mainId)}`} aria-label={`Ver ${item.name}, ${item.finalPriceVbucks.toLocaleString("es-MX")} paVos`} prefetch={false}>
      <div className={styles.art}>{item.imageUrl && <Image src={item.imageUrl} alt="" fill loading={index === 0 ? "eager" : "lazy"} sizes="(max-width: 650px) 28vw, 15vw" />}</div><div className={styles.info}><strong>{item.name}</strong><span><small>◉ {item.finalPriceVbucks.toLocaleString("es-MX")}</small><b><RegionalPrice vbucks={item.finalPriceVbucks} mxnPrice={item.priceMxn} /></b></span></div>
    </Link>)}</div>}
  </section>;
}
