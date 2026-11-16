import type { Metadata, Viewport } from "next";
import { SiteFrame } from "@/features/storefront/components/site-frame";
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
        <SiteFrame contactUrl={`https://wa.me/${whatsapp}`}>{children}</SiteFrame>
      </body>
    </html>
  );
}
