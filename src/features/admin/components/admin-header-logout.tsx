"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

export function AdminHeaderLogout() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  if (!pathname.startsWith("/admin")) return null;

  async function signOut() {
    setSigningOut(true);
    await getSupabaseBrowser()?.auth.signOut();
    router.replace("/acceso-admin");
  }

  return <button type="button" className="admin-header-logout" disabled={signingOut} onClick={() => void signOut()}><LogOut aria-hidden="true" size={17} /><span>{signingOut ? "Saliendo…" : "Cerrar sesión"}</span></button>;
}
