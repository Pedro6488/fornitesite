import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { GameStageBackdrop } from "./game-stage";
import stage from "./game-stage.module.css";

/** Portada de un juego o de una página suelta: el mismo escenario, sin selector. */
export function GamePageHero({ word, accent, eyebrow, title, lead, image, imageClassName, slim = false, aside, children }: {
  word: string;
  accent: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  image?: string;
  imageClassName?: string;
  /** Páginas de trabajo (carrito, checkout, cuenta…): el contenido tiene que verse sin bajar. */
  slim?: boolean;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={`${stage.stage} ${stage.compact} ${slim ? stage.slim : ""}`} style={{ "--stage-glow": accent } as CSSProperties}>
      <GameStageBackdrop word={word} />
      <div className={stage.inner}>
        <div>
          <p className={stage.eyebrow}><i aria-hidden="true" />{eyebrow}</p>
          <h1 className={stage.title}>{title}</h1>
          {lead && <p className={stage.lead}>{lead}</p>}
          {children}
        </div>
        {aside && <div className={stage.aside}>{aside}</div>}
        {image && (
          <div className={stage.showcase}>
            <div className={stage.main}>
              <span className={stage.frame} data-active="true">
                <span className={stage.frameArt}>
                  <Image src={image} alt="" fill preload sizes="(max-width: 760px) 90vw, 45vw" className={imageClassName} />
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
