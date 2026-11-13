"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Ellipsis, ExternalLink, Hand, Heart, LayoutDashboard, LogOut, ShoppingCart, Star, Tags, UserRoundCheck, Users, Zap, type LucideIcon } from "lucide-react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import { useAdminData } from "./use-admin-request";

type Counts = { receipts: number; deliver: number; problem: number; recipients: number };
type NavItem = { href: string; label: string; icon: LucideIcon; badge?: (counts: Counts) => number };

const OPERATION: readonly NavItem[] = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, badge: (counts) => counts.receipts + counts.deliver + counts.problem },
  { href: "/admin/destinatarios", label: "Destinatarios", icon: UserRoundCheck, badge: (counts) => counts.recipients },
];

const STORE: readonly NavItem[] = [
  { href: "/admin/precios", label: "Precios", icon: Tags },
  { href: "/admin/carritos", label: "Carritos", icon: ShoppingCart },
  { href: "/admin/favoritos", label: "Favoritos", icon: Heart },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/referencias", label: "Referencias", icon: Star },
];

const REFRESH_MS = 60_000;

/** Las pantallas llaman a `refreshCounts` después de mover un pedido o un ID para que el menú no quede atrasado. */
const AdminCountsContext = createContext<{ refreshCounts: () => void }>({ refreshCounts: () => undefined });
export function useAdminCounts() { return useContext(AdminCountsContext); }

function isCurrent(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, counts, onNavigate }: { item: NavItem; pathname: string; counts: Counts | null; onNavigate?: () => void }) {
  const Icon = item.icon;
  const badge = counts && item.badge ? item.badge(counts) : 0;
  return <Link href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined} onClick={onNavigate}>
    <Icon aria-hidden="true" size={18} />
    <span>{item.label}</span>
    {badge > 0 && <b aria-label={`${badge} por atender`}>{badge}</b>}
  </Link>;
}

export function AdminShell({ deliveryMode, children }: { deliveryMode: "manual" | "automatic"; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { data, reload } = useAdminData<{ counts: Counts }>("/api/admin/overview?view=counts", { refreshMs: REFRESH_MS });
  const counts = data?.counts ?? null;
  const ModeIcon = deliveryMode === "automatic" ? Zap : Hand;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMoreOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  async function signOut() {
    setSigningOut(true);
    await getSupabaseBrowser()?.auth.signOut();
    router.replace("/acceso-admin");
  }

  const strip = [
    { href: "/admin/pedidos?cola=payment", label: "comprobantes por revisar", short: "comprobantes", count: counts?.receipts ?? 0 },
    { href: "/admin/pedidos?cola=deliver", label: "pagados por entregar", short: "por entregar", count: counts?.deliver ?? 0 },
    { href: "/admin/pedidos?cola=problem", label: "con problema", short: "con problema", count: counts?.problem ?? 0 },
  ];

  return <AdminCountsContext.Provider value={{ refreshCounts: () => void reload() }}>
    <div className="ac-shell">
      <a className="ac-skip" href="#ac-main">Saltar al contenido</a>
      <aside className="ac-side">
        <Link className="ac-brand" href="/admin"><Image src="/games/logofin.png" width={30} height={30} alt="" /><span>SigfriedLootBox<small>Consola</small></span></Link>
        <nav aria-label="Operación">
          <p>Operación</p>
          {OPERATION.map((item) => <NavLink key={item.href} item={item} pathname={pathname} counts={counts} />)}
        </nav>
        <nav aria-label="Tienda">
          <p>Tienda</p>
          {STORE.map((item) => <NavLink key={item.href} item={item} pathname={pathname} counts={counts} />)}
        </nav>
        <div className="ac-side-foot">
          <Link href="/" target="_blank"><ExternalLink aria-hidden="true" size={16} /><span>Ver la tienda</span></Link>
          <button type="button" disabled={signingOut} onClick={() => void signOut()}><LogOut aria-hidden="true" size={16} /><span>{signingOut ? "Saliendo…" : "Cerrar sesión"}</span></button>
        </div>
      </aside>

      <div className="ac-body">
        <div className="ac-strip" role="status" aria-label="Estado de la operación">
          <span className={`ac-mode is-${deliveryMode}`} title={deliveryMode === "automatic" ? "Al confirmar el pago, el sistema envía el regalo." : "Los regalos se envían a mano en Fortnite y aquí se marcan como entregados."}>
            <ModeIcon aria-hidden="true" size={14} />{deliveryMode === "automatic" ? "Entrega automática" : "Entrega manual"}
          </span>
          {strip.map((entry) => <Link key={entry.href} href={entry.href} className={entry.count > 0 ? "is-busy" : ""} aria-label={`${entry.count} ${entry.label}`}>
            <strong>{counts ? entry.count : "–"}</strong><span>{entry.short}</span>
          </Link>)}
        </div>
        <main id="ac-main" className="ac-main">{children}</main>
      </div>

      <nav className="ac-tabbar" aria-label="Secciones">
        {OPERATION.map((item) => <NavLink key={item.href} item={item} pathname={pathname} counts={counts} />)}
        <button type="button" aria-expanded={moreOpen} aria-controls="ac-more" className={STORE.some((item) => isCurrent(pathname, item.href)) ? "is-current" : ""} onClick={() => setMoreOpen((open) => !open)}><Ellipsis aria-hidden="true" size={18} /><span>Más</span></button>
      </nav>
      {moreOpen && <div className="ac-more" id="ac-more">
        <button type="button" className="ac-more-backdrop" aria-label="Cerrar menú" onClick={() => setMoreOpen(false)} />
        <nav aria-label="Tienda y sesión">
          <p>Tienda</p>
          {STORE.map((item) => <NavLink key={item.href} item={item} pathname={pathname} counts={counts} onNavigate={() => setMoreOpen(false)} />)}
          <p>Sesión</p>
          <Link href="/" target="_blank"><ExternalLink aria-hidden="true" size={18} /><span>Ver la tienda</span></Link>
          <button type="button" disabled={signingOut} onClick={() => void signOut()}><LogOut aria-hidden="true" size={18} /><span>{signingOut ? "Saliendo…" : "Cerrar sesión"}</span></button>
        </nav>
      </div>}
    </div>
  </AdminCountsContext.Provider>;
}

/** Encabezado común de cada pantalla: qué es, para qué sirve y sus controles. */
export function AdminPageHeader({ title, lead, actions, back }: { title: string; lead?: string; actions?: ReactNode; back?: { href: string; label: string } }) {
  return <header className="ac-page-head">
    <div>
      {back && <Link className="ac-back" href={back.href}>← {back.label}</Link>}
      <h1>{title}</h1>
      {lead && <p>{lead}</p>}
    </div>
    {actions && <div className="ac-page-actions">{actions}</div>}
  </header>;
}
