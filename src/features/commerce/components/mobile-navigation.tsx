"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, Gamepad2, ShoppingBag } from "lucide-react";
import { useCommerceState } from "./commerce-state-provider";
import styles from "./mobile-navigation.module.css";

export function MobileNavigation() {
  const commerce = useCommerceState();
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname === "/acceso-admin") return null;
  const home = pathname === "/";
  return <nav className={styles.navigation} aria-label="Navegación móvil">
    <Link href="/#juegos" aria-current={home ? "page" : undefined}><Gamepad2 aria-hidden="true" size={20} strokeWidth={1.7} /><span>Juegos</span></Link>
    <Link href="/carrito" aria-current={pathname === "/carrito" ? "page" : undefined} aria-label={`Carrito de Fortnite, ${commerce.cartItemIds.length} objetos`}><ShoppingBag aria-hidden="true" size={20} strokeWidth={1.7} />{commerce.cartItemIds.length > 0 && <b>{commerce.cartItemIds.length}</b>}<span>Carrito Fortnite</span></Link>
    <Link href="/cuenta" aria-current={pathname === "/cuenta" ? "page" : undefined}><CircleUserRound aria-hidden="true" size={20} strokeWidth={1.7} /><span>Mi cuenta</span></Link>
  </nav>;
}
