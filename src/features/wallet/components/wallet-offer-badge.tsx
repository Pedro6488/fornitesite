"use client";
import { useStoreRegion } from "@/features/pricing/components/region-provider";
import { walletMoney } from "../domain/wallet";
import { offerHighlights, type PublicWalletOffers } from "../domain/wallet-offers";
import styles from "./wallet-explainer.module.css";

const n = (value: number) => value.toLocaleString("es-MX");

/** Precio real de la región elegida: tarifa, mejor tramo y mayor regalo vigente. Nada si la región no cobra. */
export function WalletOfferBadge({ offers }: { offers: PublicWalletOffers | null }) {
  const { region } = useStoreRegion();
  const highlight = offerHighlights(region, offers);
  if (!highlight) return null;
  const { basePer100, cheapest, bonus } = highlight;
  return <div className={styles.offer} role="note">
    <p><strong>{walletMoney(basePer100, region)}</strong> por cada 100 pavos{cheapest && <> · desde <strong>{walletMoney(cheapest.cents_per_100, region)}</strong> recargando {n(cheapest.min_vbucks)} o más</>}</p>
    {bonus && <p className={styles.promo}>🎁 {bonus.label}: <strong>+{(bonus.bonus_bp / 100).toLocaleString("es-MX")}% de regalo</strong> desde {n(bonus.min_vbucks)} pavos{bonus.first_topup_only ? " en tu primera recarga" : ""}, hasta el {new Date(bonus.ends_at).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}.</p>}
  </div>;
}
