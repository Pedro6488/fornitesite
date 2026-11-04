import { StorefrontTransition } from "@/features/storefront/components/storefront-transition";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ROBLOX_PACKAGES } from "@/features/roblox/packages";
import { RobloxCheckout } from "@/features/roblox/checkout";
import { GamesMenuLink } from "@/shared/components/games-menu-link";

export const metadata: Metadata = { title: "Comprar Robux | SigfriedLootBox" };

export default async function RobloxPurchasePage({ params }: { params: Promise<{ robux: string }> }) {
  const { robux } = await params;
  const pack = ROBLOX_PACKAGES.find((item) => String(item.robux) === robux);
  if (!pack) notFound();
  const whatsapp = process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "") || "5215619857749";
  return <StorefrontTransition><GamesMenuLink /><RobloxCheckout pack={pack} whatsapp={whatsapp} /></StorefrontTransition>;
}
