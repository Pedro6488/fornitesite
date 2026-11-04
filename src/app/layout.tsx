import type { Metadata, Viewport } from "next";
import { CommerceStateProvider } from "@/features/commerce/components/commerce-state-provider";
import { IdentitySheet } from "@/features/commerce/components/identity-sheet";
import { MobileNavigation } from "@/features/commerce/components/mobile-navigation";
import { RegionProvider } from "@/features/pricing/components/region-provider";
import { StorefrontHeader } from "@/features/storefront/components/storefront-header";
import { StorefrontFooter } from "@/features/storefront/components/storefront-footer";
import { RouteScrollTracker } from "@/features/storefront/components/route-scroll";
import "./globals.css";
import "./system-action-bar.css";
import "./order-operations.css";
import "./storefront-motion.css";
import "./catalog-experience.css";
import "./game-theme.css";
import "./site-system.css";

export const metadata: Metadata = {
  title: "SigfriedLootBox",
  icons: { icon: "/games/logofin.png", apple: "/games/logofin.png" },
  description: "Objetos de Fortnite, diamantes de Free Fire y códigos de Robux. Elige tu juego y encuentra tu próximo loot en SigfriedLootBox.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const whatsapp =
    process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "") || "5215619857749";
  return (
    <html lang="es-MX" data-scroll-behavior="smooth">
      <body>
        <RegionProvider>
          <CommerceStateProvider>
          <StorefrontHeader contactUrl={`https://wa.me/${whatsapp}`} />
          <RouteScrollTracker />
          <main id="main-content">{children}</main>
          <StorefrontFooter contactUrl={`https://wa.me/${whatsapp}`} />
          <MobileNavigation />
          <IdentitySheet />
          </CommerceStateProvider>
        </RegionProvider>
      </body>
    </html>
  );
}
