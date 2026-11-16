"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CommerceStateProvider } from "@/features/commerce/components/commerce-state-provider";
import { IdentitySheet } from "@/features/commerce/components/identity-sheet";
import { MobileNavigation } from "@/features/commerce/components/mobile-navigation";
import { RegionProvider } from "@/features/pricing/components/region-provider";
import { RouteScrollTracker } from "./route-scroll";
import { StorefrontFooter } from "./storefront-footer";
import { StorefrontHeader } from "./storefront-header";

/**
 * Marco de la tienda: cabecera, pie, navegación móvil, hoja de identidad y el
 * estado de compra. La consola de administración (`/admin/*`) no es parte de
 * la tienda, así que se dibuja sin nada de esto y trae su propio marco.
 */
export function SiteFrame({ contactUrl, children }: { contactUrl: string; children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return <>{children}</>;
  return <RegionProvider>
    <CommerceStateProvider>
      <StorefrontHeader contactUrl={contactUrl} />
      <RouteScrollTracker />
      <main id="main-content">{children}</main>
      <StorefrontFooter contactUrl={contactUrl} />
      <MobileNavigation />
      <IdentitySheet />
    </CommerceStateProvider>
  </RegionProvider>;
}
