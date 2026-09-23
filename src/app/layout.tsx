import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drop Shop MX",
  description: "Catálogo independiente de objetos disponibles en Fortnite."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        <header className="site-header">
          <a className="brand" href="/" aria-label="Drop Shop MX, inicio">
            <span className="brand-mark">DS</span>
            <span>DROP SHOP MX</span>
          </a>
          <nav aria-label="Navegación principal">
            <a href="/">Tienda</a>
            <a href="/cuenta">Mis compras</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <p>Este material no es oficial ni está avalado por Epic Games.</p>
        </footer>
      </body>
    </html>
  );
}
