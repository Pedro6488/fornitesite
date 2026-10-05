"use client";

import Link from "next/link";
import { CircleUserRound, Heart, House, ShoppingBag } from "lucide-react";
import { useCommerceState } from "./commerce-state-provider";

export function MobileNavigation() {
  const commerce = useCommerceState();
  return <nav className="mobile-navigation" aria-label="Navegación móvil">
    <Link className="mobile-nav-item" href="/"><House aria-hidden="true" size={19} strokeWidth={1.8} /><span>Inicio</span></Link>
    <Link className="mobile-nav-item" href="/favoritos"><Heart aria-hidden="true" size={19} strokeWidth={1.8} /><span>Favoritos</span></Link>
    <Link href="/carrito" className="mobile-nav-item mobile-cart"><ShoppingBag aria-hidden="true" size={19} strokeWidth={1.8} />{commerce.cartItemIds.length > 0 && <b>{commerce.cartItemIds.length}</b>}<span>Carrito</span></Link>
    <Link className="mobile-nav-item" href="/cuenta"><CircleUserRound aria-hidden="true" size={19} strokeWidth={1.8} /><span>Mi loot</span></Link>
  </nav>;
}
