import { ArrowRight, ArrowUpRight } from "lucide-react";
import { StorefrontLink as Link } from "@/features/storefront/components/storefront-link";
import type { PublicWalletOffers } from "../domain/wallet-offers";
import { HomeWalletCalculator } from "./home-wallet-calculator";
import { WalletBenefits } from "./wallet-explainer";
import { WalletOfferBadge } from "./wallet-offer-badge";
import styles from "./wallet-explainer.module.css";

/** Sección de la portada: qué son los pavos, por qué conviene tener saldo y a dónde ir. */
export function HomeWalletSection({ offers }: { offers: PublicWalletOffers | null }) {
  return <section className={styles.home} id="pavos" aria-labelledby="home-wallet-title">
    <div className={styles.homeIntro}>
      <div>
        <p className={styles.eyebrow}>NUEVO · PAVOS DE LA TIENDA</p>
        <h2 id="home-wallet-title">RECARGA UNA VEZ.<br /><span>COMPRA AL INSTANTE.</span></h2>
        <p className={styles.lead}>Ten saldo en SigfriedLootBox. Confirmamos tu pago una sola vez, al recargar, y desde ahí cada objeto que compres con pavos se envía solo a tu ID de Fortnite.</p>
        <WalletOfferBadge offers={offers} />
        <div className={styles.actions}>
          <Link className={styles.primary} href="/pavos">Comprar pavos <ArrowUpRight size={18} aria-hidden="true" /></Link>
          <Link className={styles.secondary} href="/pavos#como-funciona">Cómo funciona <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <small className={styles.disclaimer}>Los pavos de la tienda son saldo de SigfriedLootBox, no paVos de tu cuenta de Epic.</small>
      </div>
      <HomeWalletCalculator offers={offers} />
    </div>
    <WalletBenefits compact />
  </section>;
}
