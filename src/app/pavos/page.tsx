import type { Metadata } from "next";
import { WalletPanel } from "@/features/wallet/components/wallet-panel";
import { parseWalletAmount } from "@/features/wallet/domain/wallet-offers";
import { getPublicWalletOffers } from "@/features/wallet/server/public-offers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pavos de la tienda | SigfriedLootBox",
  description: "Recarga saldo una vez y compra objetos de Fortnite con entrega automática a tu ID.",
};

export default async function PavosPage({ searchParams }: { searchParams: Promise<{ cantidad?: string | string[] }> }) {
  const [offers, params] = await Promise.all([getPublicWalletOffers(), searchParams]);
  return <section className="community-page"><div className="loot-page-body"><WalletPanel offers={offers} initialAmount={parseWalletAmount(params.cantidad)} /></div></section>;
}
