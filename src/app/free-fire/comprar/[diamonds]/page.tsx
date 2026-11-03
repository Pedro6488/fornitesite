import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FREE_FIRE_PACKAGES } from "@/features/free-fire/packages";
import { FreeFireCheckout } from "@/features/free-fire/checkout";
import { GamesMenuLink } from "@/shared/components/games-menu-link";
import { existsSync } from "node:fs";
import path from "node:path";

export const metadata: Metadata = { title: "Comprar diamantes Free Fire | SigfriedLootBox" };

export default async function FreeFirePurchasePage({ params }: { params: Promise<{ diamonds: string }> }) {
  const { diamonds } = await params;
  const pack = FREE_FIRE_PACKAGES.find((item) => String(item.diamonds) === diamonds);
  if (!pack) notFound();
  const whatsapp = process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "") || "5215619857749";
  const profileExampleSrc = existsSync(path.join(process.cwd(), "public/games/free-fire-profile-example.png"))
    ? "/games/free-fire-profile-example.png"
    : undefined;
  return <><GamesMenuLink /><FreeFireCheckout pack={pack} whatsapp={whatsapp} profileExampleSrc={profileExampleSrc} /></>;
}
