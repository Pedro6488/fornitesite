import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SigfriedLootBox",
  description: "Catálogo independiente de objetos disponibles en Fortnite.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-MX"><body>
    <div className="utility-bar">
      <a href="https://www.facebook.com/profile.php?id=61584935750211&locale=es_LA" target="_blank" rel="noreferrer">f&nbsp; Sígueme en Facebook</a>
      <a href="https://wa.me/525555555555" target="_blank" rel="noreferrer">◉ Contáctame por WhatsApp: 55 5555 5555</a>
    </div>
    <header className="site-header">
      <Link className="brand" href="/" aria-label="SigfriedLootBox, inicio"><Image className="brand-mark" src="/sigfriedlootbox-mark.svg" alt="" width={48} height={48} /><span>Sigfried<span className="brand-accent">LootBox</span></span></Link>
      <nav aria-label="Navegación principal"><Link href="/">Tienda</Link><Link href="/favoritos">♡ Favoritos</Link><Link className="account-link" href="/cuenta">Regístrate / Inicia sesión</Link></nav>
    </header>
    <main>{children}</main>
    <section className="payment-strip" aria-label="Métodos de pago"><p>Métodos de pago</p><div><span className="payment-method bank-icon">▣ Transferencia bancaria</span><span className="payment-method paypal-icon">P PayPal</span><span className="payment-method cash-icon">◈ Depósito en efectivo</span></div></section>
    <footer><strong>SigfriedLootBox</strong> · Tu tienda de objetos Fortnite. <a href="https://www.facebook.com/profile.php?id=61584935750211&locale=es_LA" target="_blank" rel="noreferrer">Síguenos en Facebook</a></footer>
  </body></html>;
}
