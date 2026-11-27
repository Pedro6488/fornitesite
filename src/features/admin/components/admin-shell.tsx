"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Coins, Ellipsis, ExternalLink, Gift, Hand, Heart, LayoutDashboard, LogOut, Server, ShoppingCart, SlidersHorizontal, Star, Tags, UserRoundCheck, Users, Wallet, Zap, type LucideIcon } from "lucide-react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import type { DeliveryMode } from "../application/order-queues";
import { useAdminData } from "./use-admin-request";

type Counts = { receipts: number; deliver: number; problem: number; recipients: number; topups?: number };
type Quota = { used: number; limit: number; simulated: boolean } | null;
type ApiToday = { today: number; problems: number } | null;

const DeliveryModeContext = createContext<DeliveryMode>("manual");
/** Entrega manual o automática (FN Shop). Decide qué botón principal lleva cada pedido. */
export function useDeliveryMode() { return useContext(DeliveryModeContext); }

/** Quién envía los regalos: nuestra API (`OWN_API_GIFTS=on`) o FN Shop. Solo cambia los textos. */
export type GiftProvider = "own" | "fnshop";
const GiftProviderContext = createContext<GiftProvider>("fnshop");
export function useGiftProvider() { return useContext(GiftProviderContext); }
export const GIFT_PROVIDER_NAME: Record<GiftProvider, string> = { own: "nuestra API", fnshop: "FN Shop" };
/** `short` es la etiqueta de la barra inferior en móvil; `exact` no marca la sección cuando se está en una subruta hermana. */
type NavItem = { href: string; label: string; short?: string; exact?: boolean; icon: LucideIcon; badge?: (counts: Counts) => number };

const OPERATION: readonly NavItem[] = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, badge: (counts) => counts.receipts + counts.deliver + counts.problem },
  { href: "/admin/destinatarios", label: "Destinatarios", icon: UserRoundCheck, badge: (counts) => counts.recipients },
  // Liberar recargas es trabajo diario, como revisar comprobantes de pedidos: va en Operación, no en Tienda.
  { href: "/admin/pavos", label: "Recargas de pavos", short: "Recargas", exact: true, icon: Coins, badge: (counts) => counts.topups ?? 0 },
];

const FNSHOP_ITEM: NavItem = { href: "/admin/fnshop", label: "FN Shop", icon: Gift };
const OWN_API_ITEM: NavItem = { href: "/admin/api-propia", label: "API", icon: Server };

const STORE: readonly NavItem[] = [
  { href: "/admin/usuarios", label: "Usuarios registrados", icon: Users },
  { href: "/admin/pavos/clientes", label: "Clientes con pavos", icon: Wallet },
  { href: "/admin/pavos/configuracion", label: "Precios de pavos", icon: SlidersHorizontal },
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

function isCurrent(pathname: string, href: string, exact = false) {
  return href === "/admin" || exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, counts, onNavigate, compact = false }: { item: NavItem; pathname: string; counts: Counts | null; onNavigate?: () => void; compact?: boolean }) {
  const Icon = item.icon;
  const badge = counts && item.badge ? item.badge(counts) : 0;
  return <Link href={item.href} aria-current={isCurrent(pathname, item.href, item.exact) ? "page" : undefined} onClick={onNavigate}>
    <Icon aria-hidden="true" size={18} />
    <span>{compact ? item.short ?? item.label : item.label}</span>
    {badge > 0 && <b aria-label={`${badge} por atender`}>{badge}</b>}
  </Link>;
}

export function AdminShell({ deliveryMode, giftProvider = "fnshop", children }: { deliveryMode: DeliveryMode; giftProvider?: GiftProvider; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { data, reload } = useAdminData<{ counts: Counts; fnshop?: Quota; api?: ApiToday }>("/api/admin/overview?view=counts", { refreshMs: REFRESH_MS });
  const counts = data?.counts ?? null;
  const quota = data?.fnshop ?? null;
  const apiToday = data?.api ?? null;
  const ModeIcon = deliveryMode === "automatic" ? Zap : Hand;
  // FN Shop se ve también en modo manual: ahí se verifica la key antes de encender la entrega automática.
  const operation = [...OPERATION, OWN_API_ITEM, FNSHOP_ITEM];
  const quotaRatio = quota && quota.limit > 0 ? quota.used / quota.limit : 0;

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
    { href: "/admin/pavos", label: "recargas de pavos por liberar", short: "recargas", count: counts?.topups ?? 0 },
  ];

  return <DeliveryModeContext.Provider value={deliveryMode}><GiftProviderContext.Provider value={giftProvider}><AdminCountsContext.Provider value={{ refreshCounts: () => void reload() }}>
    <div className="ac-shell">
      <a className="ac-skip" href="#ac-main">Saltar al contenido</a>
      <aside className="ac-side">
        <Link className="ac-brand" href="/admin"><Image src="/games/logofin.png" width={30} height={30} alt="" /><span>SigfriedLootBox<small>Consola</small></span></Link>
        <nav aria-label="Operación">
          <p>Operación</p>
          {operation.map((item) => <NavLink key={item.href} item={item} pathname={pathname} counts={counts} />)}
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
          <span className={`ac-mode is-${deliveryMode}`} title={deliveryMode === "automatic" ? `Al confirmar el pago, el sistema envía el regalo por ${giftProvider === "own" ? "la API" : "FN Shop"}.` : "Los regalos se envían a mano en Fortnite y aquí se marcan como entregados."}>
            <ModeIcon aria-hidden="true" size={14} />{deliveryMode === "automatic" ? `Entrega automática · ${giftProvider === "own" ? "API" : "FN Shop"}` : "Entrega manual"}
          </span>
          {strip.map((entry) => <Link key={entry.href} href={entry.href} className={entry.count > 0 ? "is-busy" : ""} aria-label={`${entry.count} ${entry.label}`}>
            <strong>{counts ? entry.count : "–"}</strong><span>{entry.short}</span>
          </Link>)}
          {giftProvider === "own" && apiToday && <Link href="/admin/api-propia" className={`ac-quota${apiToday.problems > 0 ? " is-busy" : ""}`} aria-label={`API: ${apiToday.today} llamadas hoy${apiToday.problems ? `, ${apiToday.problems} con problema` : ""}`}>
            <strong>{apiToday.today.toLocaleString("es-MX")}</strong><span>API hoy{apiToday.problems ? ` · ${apiToday.problems} con problema` : ""}</span>
          </Link>}
          {giftProvider !== "own" && quota && <Link href="/admin/fnshop" className={`ac-quota${quotaRatio >= 0.85 ? " is-alert" : quotaRatio >= 0.7 ? " is-busy" : ""}`} aria-label={`FN Shop: ${quota.used} de ${quota.limit} requests usados${quota.simulated ? " (simulado)" : ""}`}>
            <strong>{quota.used.toLocaleString("es-MX")}</strong><span>/ {quota.limit.toLocaleString("es-MX")} requests{quota.simulated ? " · simulado" : ""}</span>
          </Link>}
        </div>
        <main id="ac-main" className="ac-main">{children}</main>
      </div>

      <nav className="ac-tabbar" aria-label="Secciones">
        {OPERATION.map((item) => <NavLink key={item.href} item={item} pathname={pathname} counts={counts} compact />)}
        <button type="button" aria-expanded={moreOpen} aria-controls="ac-more" className={[...STORE, OWN_API_ITEM, FNSHOP_ITEM].some((item) => isCurrent(pathname, item.href, item.exact)) ? "is-current" : ""} onClick={() => setMoreOpen((open) => !open)}><Ellipsis aria-hidden="true" size={18} /><span>Más</span></button>
      </nav>
      {moreOpen && <div className="ac-more" id="ac-more">
        <button type="button" className="ac-more-backdrop" aria-label="Cerrar menú" onClick={() => setMoreOpen(false)} />
        <nav aria-label="Tienda y sesión">
          <p>Entrega</p>
          <NavLink item={OWN_API_ITEM} pathname={pathname} counts={counts} onNavigate={() => setMoreOpen(false)} />
          <NavLink item={FNSHOP_ITEM} pathname={pathname} counts={counts} onNavigate={() => setMoreOpen(false)} />
          <p>Tienda</p>
          {STORE.map((item) => <NavLink key={item.href} item={item} pathname={pathname} counts={counts} onNavigate={() => setMoreOpen(false)} />)}
          <p>Sesión</p>
          <Link href="/" target="_blank"><ExternalLink aria-hidden="true" size={18} /><span>Ver la tienda</span></Link>
          <button type="button" disabled={signingOut} onClick={() => void signOut()}><LogOut aria-hidden="true" size={18} /><span>{signingOut ? "Saliendo…" : "Cerrar sesión"}</span></button>
        </nav>
      </div>}
    </div>
  </AdminCountsContext.Provider></GiftProviderContext.Provider></DeliveryModeContext.Provider>;
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
