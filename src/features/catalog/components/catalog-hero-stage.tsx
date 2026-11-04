"use client";

import Image from "next/image";
import { ArrowDown, Timer } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import { RegionalPrice } from "@/features/pricing/components/regional-price";
import { GameStageBackdrop, StageRail, useStageRotation } from "@/features/storefront/components/game-stage";
import stage from "@/features/storefront/components/game-stage.module.css";
import { StorefrontLink as Link } from "@/features/storefront/components/storefront-link";
import { canPurchase, type CatalogItem } from "../domain/catalog-item";
import styles from "./catalog-hero.module.css";

const CLOCK_TICK_MS = 30_000;
const STAGE_STYLE = { "--stage-glow": "var(--rarity, #8b5cf6)" } as CSSProperties;

function formatTimeLeft(until: string | null, now: number | null): string | null {
  if (!until || now === null) return null;
  const minutes = Math.floor((Date.parse(until) - now) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function CatalogHeroStage({ showcase, stats }: {
  showcase: readonly CatalogItem[];
  stats: readonly { value: number; label: string }[];
}) {
  const { activeIndex, rotating, select, interactionProps } = useStageRotation(showcase.length);
  // Solo existe en el navegador: así el HTML del servidor no depende de la hora.
  const [now, setNow] = useState<number | null>(null);
  const active = showcase[activeIndex];
  const timeLeft = formatTimeLeft(active?.availableUntil ?? null, now);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = window.setTimeout(tick, 0);
    const clock = window.setInterval(tick, CLOCK_TICK_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(clock);
    };
  }, []);

  return (
    <section className={stage.stage} style={STAGE_STYLE} data-rarity={active?.rarity} aria-label="Destacados de la tienda de Fortnite">
      <GameStageBackdrop word="FORTNITE" />

      <div className={stage.inner}>
        <div>
          <p className={stage.eyebrow}><i aria-hidden="true" />Tienda de Fortnite</p>
          <h1 className={stage.title}>Elige tu <br /><span>siguiente<br className={styles.titleBreak} /> look.</span></h1>
          <p className={`${stage.lead} ${styles.lead}`}>Tu estilo, dentro y fuera del bus. Confirma el precio, la disponibilidad y tu ID antes de pagar.</p>
          <div className={styles.actions}>
            <a className={stage.cta} href="#catalogo">Ver toda la tienda <ArrowDown aria-hidden="true" size={18} /></a>
            <dl className={styles.stats}>
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dd>{stat.value.toLocaleString("es-MX")}</dd>
                  <dt>{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {active && (
          <div className={stage.showcase} {...interactionProps}>
            <div className={stage.main}>
              <span className={styles.platform} aria-hidden="true" />
              {showcase.map((item, index) => (
                <div className={styles.character} data-active={index === activeIndex} key={item.mainId}>
                  <Image src={item.imageUrl!} alt={index === activeIndex ? item.name : ""} fill preload={index === 0} loading={index === 0 ? undefined : "eager"} sizes="(max-width: 760px) 80vw, 42vw" />
                </div>
              ))}
            </div>

            <div className={stage.plate} key={active.mainId}>
              <Link
                className={styles.plateInfo}
                href={`/objetos/${encodeURIComponent(active.mainId)}`}
                aria-label={`Ver ${active.name}, ${active.finalPriceVbucks.toLocaleString("es-MX")} paVos`}
                prefetch={false}
              >
                <small>{active.type} · {active.rarity}</small>
                <strong>{active.name}</strong>
                <span className={styles.plateMeta}>
                  <b><RegionalPrice vbucks={active.finalPriceVbucks} mxnPrice={active.priceMxn} /></b>
                  <em>◉ {active.finalPriceVbucks.toLocaleString("es-MX")}</em>
                </span>
              </Link>
              <div className={styles.plateActions}>
                {timeLeft && <p><Timer aria-hidden="true" size={14} />Sale en {timeLeft}</p>}
                {canPurchase(active) && <AddToCartButton item={active} compact />}
              </div>
            </div>

            <StageRail
              label="Elegir objeto destacado"
              activeIndex={activeIndex}
              rotating={rotating}
              onSelect={select}
              options={showcase.map((item) => ({ id: item.mainId, name: item.name, image: item.imageUrl!, rarity: item.rarity }))}
            />
          </div>
        )}
      </div>
    </section>
  );
}
