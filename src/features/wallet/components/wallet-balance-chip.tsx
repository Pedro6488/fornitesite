"use client";
import Link from "next/link";
import { Coins } from "lucide-react";
import { useOptionalCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { useWalletBalance } from "./use-wallet-balance";

/** Saldo siempre a la vista para quien inició sesión; lleva a /pavos. */
export function WalletBalanceChip({ className }: { className?: string }) {
  const commerce = useOptionalCommerceState();
  const balance = useWalletBalance(Boolean(commerce?.authenticated), commerce?.sessionId);
  if (!commerce?.authenticated || !balance) return null;
  const amount = balance.balance.toLocaleString("es-MX");
  const label = `Tus pavos de la tienda: ${amount}${balance.inReview ? `, más ${balance.inReview.toLocaleString("es-MX")} en revisión` : ""}${balance.frozen ? ", saldo en revisión" : ""}`;
  return <Link className={className} href="/pavos" aria-label={label} title={label} data-frozen={balance.frozen || undefined}>
    <Coins aria-hidden="true" size={16} />
    <strong>{amount}</strong>
    <span>pavos</span>
    {balance.inReview > 0 && <em aria-hidden="true">+{balance.inReview.toLocaleString("es-MX")}</em>}
  </Link>;
}
