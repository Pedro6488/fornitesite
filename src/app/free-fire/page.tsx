import { StorefrontTransition } from "@/features/storefront/components/storefront-transition";
import type { Metadata } from "next";
import { StorefrontLink as Link } from "@/features/storefront/components/storefront-link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { GamesMenuLink } from "@/shared/components/games-menu-link";
import { FREE_FIRE_PACKAGES } from "@/features/free-fire/packages";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";
import stage from "@/features/storefront/components/game-stage.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Diamantes Free Fire | SigfriedLootBox",
  description: "Elige tu paquete de diamantes de Free Fire y solicita tu compra por WhatsApp. Precios en pesos mexicanos.",
};

export default function FreeFirePage() {
  return (
    <StorefrontTransition>
    <GamesMenuLink />
    <GamePageHero
      word="FREE FIRE"
      accent="#f97316"
      eyebrow="Free Fire · Diamantes"
      title={<>Más diamantes.<br /><span>Más posibilidades.</span></>}
      lead="Elige tus diamantes y solicita la recarga por WhatsApp. Necesitarás tu nick y UID."
      image="/games/diamantes-freefire.png"
      imageClassName={stage.artDiamonds}
    />
    <div className={styles.page}>
      <section aria-labelledby="packages-title">
        <div className={styles.heading}><h2 id="packages-title">Elige tu recarga</h2><span>Precios en MXN</span></div>
        <ul className={styles.packages}>
          {FREE_FIRE_PACKAGES.map(({ diamonds, price }, index) => {
            const quantity = diamonds.toLocaleString("es-MX");
            return (
              <li className={styles.package} key={diamonds}>
                <div className={styles.art} aria-hidden="true">
                  <span className={styles.number}>0{index + 1}</span>
                  <Image src="/games/diamantes-freefire.png" alt="" fill sizes="(max-width: 1050px) 50vw, 25vw" className={styles.diamondImage} />
                </div>
                <div className={styles.details}>
                  <h3>{quantity} <span>diamantes</span></h3>
                  <p className={styles.price}>${price}<span>MXN</span></p>
                  <Link href={`/free-fire/comprar/${diamonds}`} className={styles.buy} aria-label={`Comprar ${quantity} diamantes por $${price} MXN`}>
                    Solicitar <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
        <p className={styles.note}>Necesitarás el nick y UID de tu perfil de Free Fire. Revisa tus datos antes de enviar la solicitud al administrador.</p>
      </section>
    </div>
    </StorefrontTransition>
  );
}
