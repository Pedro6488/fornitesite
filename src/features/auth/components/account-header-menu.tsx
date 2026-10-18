"use client";

import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
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

  if (!commerce.authenticated) return <Link className="account-link account-header-guest" href="/cuenta">
    <UserRound aria-hidden="true" size={17} />
    <span>Cuenta</span>
  </Link>;

  async function signOut() {
    setSigningOut(true);
    await getSupabaseBrowser()?.auth.signOut();
    window.location.assign("/");
  }

  return <details className="account-header-menu" ref={menuRef}>
    <summary aria-label="Abrir opciones de cuenta">
      <span className="account-header-avatar"><UserRound aria-hidden="true" size={17} /></span>
      <span>Mi cuenta</span>
      <ChevronDown className="account-header-chevron" aria-hidden="true" size={14} />
    </summary>
    <div className="account-header-popover">
      <Link href="/cuenta"><LayoutDashboard aria-hidden="true" size={16} /><span>Mi dashboard</span></Link>
      <button type="button" disabled={signingOut} onClick={() => void signOut()}><LogOut aria-hidden="true" size={16} /><span>{signingOut ? "Saliendo…" : "Cerrar sesión"}</span></button>
    </div>
  </details>;
}
