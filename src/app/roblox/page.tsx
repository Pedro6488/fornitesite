import { StorefrontTransition } from "@/features/storefront/components/storefront-transition";
import type { Metadata } from "next";
import { StorefrontLink as Link } from "@/features/storefront/components/storefront-link";
import { ArrowUpRight } from "lucide-react";
import { GamesMenuLink } from "@/shared/components/games-menu-link";
import { ROBLOX_PACKAGES } from "@/features/roblox/packages";
import { RobuxArt } from "@/features/roblox/robux-art";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";
import stage from "@/features/storefront/components/game-stage.module.css";
import styles from "../free-fire/page.module.css";
import roblox from "./page.module.css";

export const metadata: Metadata = {
  title: "Robux Roblox | SigfriedLootBox",
  description: "Códigos canjeables de Roblox desde $60 MXN. Solicita tu compra por WhatsApp sin proporcionar datos de tu cuenta.",
};

export default function RobloxPage() {
  return <StorefrontTransition><GamesMenuLink />
    <GamePageHero
      word="ROBLOX"
      accent="#e8b94a"
      eyebrow="Roblox · Códigos canjeables"
      title={<>Tu mundo.<br /><span>Tus posibilidades.</span></>}
      lead="Elige tus Robux y recibe un código canjeable. Solo necesitamos tu WhatsApp para coordinar la compra."
      image="/games/robux.png"
      imageClassName={stage.artRoblox}
    />
    <div className={`${styles.page} ${roblox.page}`}>
    <section aria-labelledby="robux-title">
      <div className={styles.heading}><h2 id="robux-title">Elige tu paquete de Robux</h2><span>Precios en MXN</span></div>
      <ul className={[styles.packages, roblox.packages].join(" ")}>
        {ROBLOX_PACKAGES.map(({ robux: amount, price }, index) => {
          const quantity = amount.toLocaleString("es-MX");
          return <li key={amount} className={styles.package}>
            <div className={[styles.art, roblox.art].join(" ")}><span className={styles.number}>0{index + 1}</span><RobuxArt className={roblox.coin} /></div>
            <div className={styles.details}>
              <h3>{quantity}<span>Robux · código canjeable</span></h3>
              <p className={styles.price}>${price.toLocaleString("es-MX")}<span>MXN</span></p>
              <Link href={`/roblox/comprar/${amount}`} className={styles.buy} aria-label={`Comprar ${quantity} Robux por $${price} MXN`}>Solicitar <ArrowUpRight size={17} aria-hidden="true" /></Link>
            </div>
          </li>;
        })}
      </ul>
      <p className={styles.note}>Todos los paquetes se entregan como códigos canjeables. No necesitamos datos de tu cuenta de Roblox. Coordina el pago y la entrega por WhatsApp.</p>
    </section>
  </div></StorefrontTransition>;
}
