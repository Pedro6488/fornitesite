"use client";

import Link from "next/link";
import { BadgeCheck, CircleAlert, Clock3, Heart, LayoutDashboard, LogIn, LogOut, Menu, ScanLine, UserPlus, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { getIdentityPresentation } from "@/features/commerce/application/identity-presentation";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

export function AccountHeaderMenu() {
  const pathname = usePathname();
  const commerce = useCommerceState();
  const identity = getIdentityPresentation(commerce.validation);
  const IdentityIcon = identity.tone === "success" ? BadgeCheck : identity.tone === "danger" ? CircleAlert : identity.tone === "warning" ? Clock3 : ScanLine;
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) menuRef.current?.removeAttribute("open");
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") menuRef.current?.removeAttribute("open");
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (pathname.startsWith("/admin") || pathname === "/acceso-admin") return null;

  async function signOut() {
    setSigningOut(true);
    await getSupabaseBrowser()?.auth.signOut();
    window.location.assign("/");
  }

  function openIdentity() {
    menuRef.current?.removeAttribute("open");
    commerce.openIdentity();
  }

  return <details className={`account-header-menu ${commerce.authenticated ? "authenticated" : "guest"}`} ref={menuRef}>
    <summary aria-label={commerce.authenticated ? "Abrir menú de mi cuenta" : "Abrir opciones de acceso"}>
      <Menu className="account-header-menu-icon" aria-hidden="true" size={17} />
      <span className="account-header-avatar"><UserRound aria-hidden="true" size={17} /></span>
    </summary>
    <div className="account-header-popover">
      {!commerce.ready ? <span className="account-header-loading">Cargando opciones…</span> : <>
        <section className={`account-menu-identity ${identity.tone}`}>
          <IdentityIcon aria-hidden="true" size={19} />
          <div><small>ENTREGA A</small><strong>{commerce.validation?.display_name ?? "Sin destinatario"}</strong><span>{identity.label}</span></div>
          <button type="button" onClick={openIdentity}>{commerce.validation ? "Cambiar o agregar ID" : "Agregar ID"}</button>
        </section>
        <Link className="account-menu-favorites" href="/favoritos"><Heart aria-hidden="true" size={17} /><span>Favoritos</span><b>{commerce.favoriteItemIds.size}</b></Link>
        <div className="account-menu-divider" />
        {commerce.authenticated ? <>
          <Link href="/cuenta"><LayoutDashboard aria-hidden="true" size={16} /><span>Mi cuenta</span></Link>
          <button className="account-menu-signout" type="button" disabled={signingOut} onClick={() => void signOut()}><LogOut aria-hidden="true" size={16} /><span>{signingOut ? "Saliendo…" : "Cerrar sesión"}</span></button>
        </> : <>
          <Link className="account-menu-primary" href="/cuenta?mode=register"><UserPlus aria-hidden="true" size={16} /><span>Crear cuenta</span></Link>
          <Link href="/cuenta"><LogIn aria-hidden="true" size={16} /><span>Iniciar sesión</span></Link>
        </>}
      </>}
    </div>
  </details>;
}
