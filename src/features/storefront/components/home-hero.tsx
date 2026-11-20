"use client";

import Image from "next/image";
import { ArrowDown, ArrowRight, ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";

import { GameStageBackdrop, StageRail, useStageRotation } from "./game-stage";
import stage from "./game-stage.module.css";
import { StorefrontLink as Link } from "./storefront-link";
import styles from "./home-hero.module.css";

const FALLBACK_SLIDES = [
  { id: "fortnite", name: "Fortnite", word: "FORTNITE", accent: "#a855f7", image: "/games/fortnite.jpg", artClass: stage.artFortnite, href: "/fortnite#catalogo", kicker: "Tu estilo salta del bus", detail: "Objetos de la tienda", action: "Explorar objetos" },
] as const;

export function HomeHero({ items }: { items: readonly { id: string; name: string; image: string }[] }) {
  const SLIDES = items.length ? items.map((item) => ({ ...FALLBACK_SLIDES[0], ...item, artClass: styles.catalogArt, href: `/objetos/${encodeURIComponent(item.id)}`, detail: "Objeto del catalogo", action: "Ver objeto" })) : FALLBACK_SLIDES;
  const { activeIndex, rotating, select, interactionProps } = useStageRotation(SLIDES.length);
  const active = SLIDES[activeIndex];

  return (
    <section className={stage.stage} style={{ "--stage-glow": active.accent } as CSSProperties} aria-labelledby="home-title">
      <GameStageBackdrop word={active.word} />

      <div className={stage.inner}>
        <div className={styles.copy}>
          <p className={stage.eyebrow}><i aria-hidden="true" />Para los que viven el juego</p>
          <h1 id="home-title" className={`${stage.title} ${styles.title}`}>Tu próximo<br /><span>drop</span> está<br className={styles.titleBreak} /> aquí<span>.</span></h1>
          <p className={`${stage.lead} ${styles.lead}`}>Tu squad reconoce tu nombre. <strong>Que también reconozca tu estilo.</strong></p>
          <div className={styles.actions}>
            <Link href="/fortnite#catalogo" className={stage.cta}>Explorar Fortnite <ArrowRight size={19} aria-hidden="true" /></Link>
            <a href="#referencias" className={styles.secondary}>Ver referencias <ArrowDown size={17} aria-hidden="true" /></a>
          </div>
          <p className={styles.reassurance}><ShieldCheck size={15} aria-hidden="true" /> Tu contraseña se queda contigo.</p>
        </div>

        <div className={stage.showcase} {...interactionProps}>
          <div className={`${stage.main} ${styles.main}`}>
            {SLIDES.map((slide, index) => (
              <Link
                className={stage.frame}
                data-active={index === activeIndex}
                href={slide.href}
                key={slide.id}
                tabIndex={-1}
                aria-hidden="true"
              >
                <span className={stage.frameArt}>
                  <Image src={slide.image} alt="" fill preload={index === 0} loading={index === 0 ? undefined : "eager"} sizes="(max-width: 760px) 90vw, 45vw" className={slide.artClass} />
                </span>
              </Link>
            ))}
          </div>

          <Link className={`${stage.plate} ${styles.plate}`} href={active.href} key={active.id} aria-label={`${active.name}: ${active.action}`}>
            <span className={styles.plateCopy}>
              <small>{active.kicker}</small>
              <strong>{active.name}</strong>
              <span>{active.detail}</span>
            </span>
            <span className={styles.plateAction}>{active.action} <ArrowRight aria-hidden="true" size={17} /></span>
          </Link>

          <StageRail
            label="Elegir juego destacado"
            activeIndex={activeIndex}
            rotating={rotating}
            onSelect={select}
            options={SLIDES.map((slide) => ({ id: slide.id, name: slide.name, image: slide.image, accent: slide.accent }))}
          />
        </div>
      </div>
    </section>
  );
}
