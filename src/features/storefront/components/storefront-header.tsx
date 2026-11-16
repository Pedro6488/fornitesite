"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { AccountHeaderMenu } from "@/features/auth/components/account-header-menu";
import { CartLink } from "@/features/cart/components/cart-link";
import { RegionSelector } from "@/features/pricing/components/region-selector";
import styles from "./storefront-shell.module.css";

export function StorefrontHeader({ contactUrl }: { contactUrl: string }) {
  const pathname = usePathname();
  const hasRegion = ["/fortnite", "/objetos", "/carrito", "/checkout", "/favoritos"].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return <header className={styles.header}>
    <a className={styles.skip} href="#main-content">Saltar al contenido</a>
    <div className={styles.headerInner}>
      <Link className={styles.brand} href="/" aria-label="SigfriedLootBox, inicio"><Image src="/games/logofin.png" width={42} height={42} alt="" className={styles.brandMark} /><span>Sigfried<span>LootBox</span></span></Link>
      <nav className={styles.navigation} aria-label="Navegación principal"><Link href="/#juegos">Juegos</Link><Link href="/#como-comprar">Cómo comprar</Link><Link href="/referencias">Referencias</Link></nav>
      <div className={styles.actions}>
        {hasRegion && <div className={styles.region}><RegionSelector /></div>}
        <div className={styles.cart}><CartLink label="Carrito Fortnite" /></div>
        <a className={styles.help} href={contactUrl} target="_blank" rel="noopener noreferrer">Hablemos <ArrowUpRight size={15} aria-hidden="true" /></a>
        <AccountHeaderMenu />
      </div>
    </div>
  </header>;
}
