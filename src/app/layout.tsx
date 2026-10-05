import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CartLink } from "@/features/cart/components/cart-link";
import { CommerceStateProvider } from "@/features/commerce/components/commerce-state-provider";
import { IdentitySheet } from "@/features/commerce/components/identity-sheet";
import { IdentityNavButton } from "@/features/commerce/components/identity-nav-button";
import { MobileNavigation } from "@/features/commerce/components/mobile-navigation";
import "./globals.css";

export const metadata: Metadata = { title: "SigfriedLootBox", description: "Catálogo independiente de objetos disponibles en Fortnite." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const whatsapp = process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "");
  return <html lang="es-MX" data-scroll-behavior="smooth"><body><CommerceStateProvider>
    <div className="utility-bar"><span>Compra protegida · Precio confirmado en servidor</span><a href="https://www.facebook.com/profile.php?id=61584935750211&locale=es_LA" target="_blank" rel="noreferrer">Sígueme en Facebook</a>{whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Ayuda por WhatsApp</a>}</div>
    <header className="site-header"><Link className="brand" href="/" aria-label="SigfriedLootBox, inicio"><Image className="brand-mark" src="/sigfriedlootbox-mark.svg" alt="" width={48} height={48} priority /><span>Sigfried<span className="brand-accent">LootBox</span></span></Link><nav className="desktop-navigation" aria-label="Navegación principal"><Link href="/">Tienda</Link><Link href="/favoritos">♡ Favoritos</Link><IdentityNavButton /><CartLink /><Link className="account-link" href="/cuenta">Cuenta</Link></nav></header>
    <main>{children}</main>
    <section className="payment-strip" aria-label="Pago y seguimiento"><p>Compra acompañada</p><div><span className="payment-method bank-icon">▣ Transferencia bancaria</span><span className="payment-method support-icon">◉ Comprobante privado</span><span className="payment-method whatsapp-icon">↗ Postventa por WhatsApp</span></div></section>
    <footer><strong>SigfriedLootBox</strong> · Precio seguro, ID validado y seguimiento de cada pedido.</footer>
    <MobileNavigation /><IdentitySheet />
  </CommerceStateProvider></body></html>;
}
