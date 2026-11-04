"use client";

import Image from "next/image";
import { ArrowDown, ArrowRight, ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";
import { FREE_FIRE_STARTING_PRICE, ROBLOX_STARTING_PRICE, formatStoreMxn } from "../games";
import { ContinueGameLink } from "./continue-game-link";
import { GameStageBackdrop, StageRail, useStageRotation } from "./game-stage";
import stage from "./game-stage.module.css";
import { StorefrontLink as Link } from "./storefront-link";
import styles from "./home-hero.module.css";

const SLIDES = [
  { id: "fortnite", name: "Fortnite", word: "FORTNITE", accent: "#a855f7", image: "/games/fortnite.jpg", artClass: stage.artFortnite, href: "/fortnite#catalogo", kicker: "Tu estilo salta del bus", detail: "Objetos de la tienda", action: "Explorar objetos" },
  { id: "free-fire", name: "Free Fire", word: "FREE FIRE", accent: "#f97316", image: "/games/free-fire.jpg", artClass: stage.artFreeFire, href: "/free-fire", kicker: "Listo para el Booyah", detail: `Diamantes desde ${formatStoreMxn(FREE_FIRE_STARTING_PRICE)} MXN`, action: "Ver diamantes" },
  { id: "roblox", name: "Roblox", word: "ROBLOX", accent: "#e8b94a", image: "/games/robux.png", artClass: stage.artRoblox, href: "/roblox", kicker: "Imagina lo que sigue", detail: `Robux desde ${formatStoreMxn(ROBLOX_STARTING_PRICE)} MXN`, action: "Ver Robux" }
] as const;

export function HomeHero() {
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
            <ContinueGameLink className={stage.cta} />
            <a href="#juegos" className={styles.secondary}>Todos los juegos <ArrowDown size={17} aria-hidden="true" /></a>
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
