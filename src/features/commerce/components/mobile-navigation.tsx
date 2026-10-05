"use client";

import Link from "next/link";
import { useCommerceState } from "./commerce-state-provider";

export function MobileNavigation() {
  const commerce = useCommerceState();
  return <nav className="mobile-navigation" aria-label="Navegación móvil">
    <Link href="/"><span aria-hidden="true">⌂</span><small>Inicio</small></Link>
    <Link href="/favoritos"><span aria-hidden="true">♡</span><small>Favoritos</small></Link>
    <button className={commerce.validation?.status === "ready" ? "identity-ready" : ""} onClick={commerce.openIdentity}><span aria-hidden="true">◎</span><small>{commerce.validation?.status === "ready" ? "ID listo" : "Validar ID"}</small></button>
    <Link href="/carrito" className="mobile-cart"><span aria-hidden="true">▱</span>{commerce.cartItemIds.length > 0 && <b>{commerce.cartItemIds.length}</b>}<small>Carrito</small></Link>
    <Link href="/cuenta"><span aria-hidden="true">○</span><small>Cuenta</small></Link>
  </nav>;
}
