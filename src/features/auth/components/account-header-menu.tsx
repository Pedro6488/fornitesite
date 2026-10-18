"use client";

import Link from "next/link";
import { LayoutDashboard, LogIn, LogOut, Menu, UserPlus, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

export function AccountHeaderMenu() {
  const pathname = usePathname();
  const commerce = useCommerceState();
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

  return <details className={`account-header-menu ${commerce.authenticated ? "authenticated" : "guest"}`} ref={menuRef}>
    <summary aria-label={commerce.authenticated ? "Abrir menú de mi cuenta" : "Abrir opciones de acceso"}>
      <Menu className="account-header-menu-icon" aria-hidden="true" size={17} />
      <span className="account-header-avatar"><UserRound aria-hidden="true" size={17} /></span>
    </summary>
    <div className="account-header-popover">
      {!commerce.ready ? <span className="account-header-loading">Cargando cuenta…</span> : commerce.authenticated ? <>
        <Link href="/cuenta"><LayoutDashboard aria-hidden="true" size={16} /><span>Mi cuenta</span></Link>
        <button type="button" disabled={signingOut} onClick={() => void signOut()}><LogOut aria-hidden="true" size={16} /><span>{signingOut ? "Saliendo…" : "Cerrar sesión"}</span></button>
      </> : <>
        <Link className="account-menu-primary" href="/cuenta?mode=register"><UserPlus aria-hidden="true" size={16} /><span>Crear cuenta</span></Link>
        <Link href="/cuenta"><LogIn aria-hidden="true" size={16} /><span>Iniciar sesión</span></Link>
      </>}
    </div>
  </details>;
}
