"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { StorefrontLink as Link } from "@/features/storefront/components/storefront-link";
import type { PublicWalletOffers } from "../domain/wallet-offers";
import { WalletCalculator } from "./wallet-calculator";
import explainer from "./wallet-explainer.module.css";

/** Calculadora de la portada: el visitante juega con la cantidad y la lleva a /pavos para comprar. */
export function HomeWalletCalculator({ offers }: { offers: PublicWalletOffers | null }) {
  const [amount, setAmount] = useState(5000);
  return <WalletCalculator variant="compact" amount={amount} onAmount={setAmount} source={offers}>
    {() => <Link className={explainer.primary} href={`/pavos?cantidad=${amount}#recargar`}>Quiero {amount.toLocaleString("es-MX")} pavos <ArrowUpRight size={18} aria-hidden="true" /></Link>}
  </WalletCalculator>;
}
