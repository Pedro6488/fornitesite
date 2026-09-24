import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drop Shop MX",
  description: "Catálogo independiente de objetos disponibles en Fortnite.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="Drop Shop MX, inicio">
            <span className="brand-mark">DS</span>
            <span>DROP SHOP MX</span>
          </Link>
          <nav aria-label="Navegación principal">
            <Link href="/">Tienda</Link>
            <Link href="/cuenta">Mis compras</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
