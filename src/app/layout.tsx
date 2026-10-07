import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Globe2,
  Heart,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Analytics } from "@vercel/analytics/next";
import { CartLink } from "@/features/cart/components/cart-link";
import { CommerceStateProvider } from "@/features/commerce/components/commerce-state-provider";
import { IdentitySheet } from "@/features/commerce/components/identity-sheet";
import { IdentityNavButton } from "@/features/commerce/components/identity-nav-button";
import { MobileNavigation } from "@/features/commerce/components/mobile-navigation";
import { AdminHeaderLogout } from "@/features/admin/components/admin-header-logout";
import "./globals.css";
import "./system-action-bar.css";
import "./order-operations.css";

export const metadata: Metadata = {
  title: "SigfriedLootBox",
  description: "Catálogo independiente de objetos disponibles en Fortnite.",
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
        <CommerceStateProvider>
          <div className="utility-bar">
            <div className="utility-bar-inner">
              <span className="trust-message">
                <ShieldCheck aria-hidden="true" size={15} />
                Compra protegida · precio confirmado en servidor
              </span>
              <div className="utility-links">
                <a
                  className="whatsapp-contact"
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle aria-hidden="true" size={14} />
                  WhatsApp <strong>56 1985 7749</strong>
                </a>
                <a
                  className="utility-social"
                  href="https://www.facebook.com/profile.php?id=61584935750211&locale=es_LA"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Globe2 aria-hidden="true" size={13} />
                  Facebook
                </a>
              </div>
            </div>
          </div>
          <header className="site-header">
            <div className="site-header-inner">
              <Link
                className="brand"
                href="/"
                aria-label="SigfriedLootBox, inicio"
              >
                <Image
                  className="brand-mark"
                  src="/sigfriedlootbox-mark.svg"
                  alt=""
                  width={48}
                  height={48}
                  priority
                />
                <span>
                  Sigfried<span className="brand-accent">LootBox</span>
                </span>
              </Link>
              <div className="mobile-header-actions">
                <IdentityNavButton />
                <AdminHeaderLogout />
              </div>
              <nav
                className="desktop-navigation"
                aria-label="Navegación principal"
              >
                <Link className="desktop-nav-link" href="/favoritos">
                  <Heart aria-hidden="true" size={17} />
                  Favoritos
                </Link>
                <IdentityNavButton />
                <CartLink />
                <Link className="account-link" href="/cuenta">
                  <UserRound aria-hidden="true" size={17} />
                  Cuenta
                </Link>
                <AdminHeaderLogout />
              </nav>
            </div>
          </header>
          <main>{children}</main>
          <footer className="site-footer">
            <div className="footer-brand">
              <strong>
                Sigfried<span>LootBox</span>
              </strong>
              <p>
                Objetos, precio claro y acompañamiento durante toda tu compra.
              </p>
            </div>
            <nav className="footer-links" aria-label="Enlaces del pie">
              <Link href="/#catalogo">Tienda</Link>
              <Link href="/favoritos">Favoritos</Link>
              <Link href="/carrito">Carrito</Link>
            </nav>
            <div className="footer-contact">
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle aria-hidden="true" size={15} />
                WhatsApp 56 1985 7749
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61584935750211&locale=es_LA"
                target="_blank"
                rel="noreferrer"
              >
                <Globe2 aria-hidden="true" size={15} />
                Facebook
              </a>
            </div>
          </footer>
          <MobileNavigation />
          <IdentitySheet />
        </CommerceStateProvider>
        <Analytics />
      </body>
    </html>
  );
}
