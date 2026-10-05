"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { SupervisorOrders } from "@/features/orders/components/supervisor-orders";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

type Tab = "summary" | "orders" | "carts" | "favorites" | "prices";
type Metrics = { pendingOrders: number; receiptsToReview: number; activeCarts: number; abandonedCarts: number; favorites: number };
type Cart = { id: string; status: string; updated_at: string; abandoned: boolean; estimatedAmountMxnCents: number; shopping_cart_items: { item_main_id: string }[]; validation: null | { display_name: string; platform: string; status: string }; commerce_sessions: null | { whatsapp: string | null; user_id: string | null } };
type FavoriteDetail = { item_main_id: string; commerce_session_id: string; created_at: string; commerce_sessions: null | { user_id: string | null } };
type PriceRule = { id: string; min_vbucks: number; max_vbucks: number | null; mxn_per_hundred: number | string; active: boolean; effective_from: string; effective_until: string | null };
type PriceOverride = { id: string; main_id: string; amount_mxn_cents: number; active: boolean; effective_from: string; effective_until: string | null };

export function CommerceAdminDashboard() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [tab, setTab] = useState<Tab>("summary");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session) throw new Error("La sesión de administrador expiró.");
    const response = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No fue posible completar la operación.");
    return body;
  }, [supabase]);

  const load = useCallback(async (activeTab: Tab) => {
    if (activeTab === "orders") return;
    setMessage(null); setData(null);
    try { setData(await request(activeTab === "prices" ? "/api/admin/prices" : `/api/admin/dashboard?view=${activeTab}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar el dashboard."); }
  }, [request]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load(tab));
    return () => window.cancelAnimationFrame(frame);
  }, [load, tab]);

  return <section className="admin-dashboard">
    <header className="admin-dashboard-heading"><div><p className="eyebrow">OPERACIÓN SEGURA</p><h1>Panel de comercio</h1><p>Pedidos, intención de compra y precios desde una sola fuente.</p></div><button onClick={() => void load(tab)}>Actualizar</button></header>
    <nav className="admin-tabs" aria-label="Secciones del dashboard">{(["summary", "orders", "carts", "favorites", "prices"] as Tab[]).map((value) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{({ summary: "Resumen", orders: "Pedidos", carts: "Carritos", favorites: "Favoritos", prices: "Precios" } as const)[value]}</button>)}</nav>
    {message && <p className="notice error">{message}</p>}
    {tab === "summary" && data && <Summary metrics={data.metrics as Metrics} />}
    {tab === "orders" && <SupervisorOrders />}
    {tab === "carts" && data && <Carts carts={data.carts as Cart[]} />}
    {tab === "favorites" && data && <Favorites ranking={data.ranking as { itemMainId: string; count: number }[]} favorites={data.favorites as FavoriteDetail[]} />}
    {tab === "prices" && data && <Prices data={data as { rules: PriceRule[]; overrides: PriceOverride[] }} request={request} reload={() => load("prices")} />}
  </section>;
}

function Summary({ metrics }: { metrics: Metrics }) {
  const cards = [["Pedidos activos", metrics.pendingOrders], ["Comprobantes por revisar", metrics.receiptsToReview], ["Carritos activos", metrics.activeCarts], ["Carritos abandonados", metrics.abandonedCarts], ["Favoritos guardados", metrics.favorites]];
  return <div className="admin-metrics">{cards.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>;
}

function Carts({ carts }: { carts: Cart[] }) {
  return <div className="admin-data-list">{carts.length === 0 ? <p className="notice">No hay carritos persistidos.</p> : carts.map((cart) => <article key={cart.id} className="admin-data-card"><div><span className={`order-status-pill ${cart.abandoned ? "status-expired" : `status-${cart.status}`}`}>{cart.abandoned ? "Abandonado" : cart.status}</span><h2>{cart.validation?.display_name ?? `Visitante ${cart.id.slice(0, 8)}`}</h2><p>{cart.validation ? `${cart.validation.platform} · ${cart.validation.status}` : "ID todavía no proporcionado"}</p></div><div><strong>{cart.shopping_cart_items.length} objetos · ${(cart.estimatedAmountMxnCents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</strong><p>{cart.shopping_cart_items.map((item) => item.item_main_id).join(", ") || "Carrito vacío"}</p><small>Actividad: {new Date(cart.updated_at).toLocaleString("es-MX")}</small></div></article>)}</div>;
}

function Favorites({ ranking, favorites }: { ranking: { itemMainId: string; count: number }[]; favorites: FavoriteDetail[] }) {
  return <div className="admin-data-list"><div className="admin-ranking"><div className="admin-table-head"><span>Objeto</span><span>Veces guardado</span></div>{ranking.length === 0 ? <p className="notice">Todavía no hay favoritos.</p> : ranking.map((item, index) => <div key={item.itemMainId}><span><b>#{index + 1}</b>{item.itemMainId}</span><strong>{item.count}</strong></div>)}</div>{favorites.length > 0 && <section className="admin-ranking"><h2>Detalle reciente</h2><div className="admin-table-head"><span>Sesión / usuario</span><span>Objeto</span></div>{favorites.slice(0, 100).map((favorite) => <div key={`${favorite.commerce_session_id}-${favorite.item_main_id}`}><span>{favorite.commerce_sessions?.user_id ? `Usuario ${favorite.commerce_sessions.user_id.slice(0, 8)}` : `Visitante ${favorite.commerce_session_id.slice(0, 8)}`}</span><strong>{favorite.item_main_id}</strong></div>)}</section>}</div>;
}

function Prices({ data, request, reload }: { data: { rules: PriceRule[]; overrides: PriceOverride[] }; request: (url: string, init?: RequestInit) => Promise<Record<string, unknown>>; reload: () => Promise<void> }) {
  const [kind, setKind] = useState<"rule" | "override">("rule");
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const effectiveFrom = form.get("from") ? new Date(String(form.get("from"))).toISOString() : undefined;
    const effectiveUntil = form.get("until") ? new Date(String(form.get("until"))).toISOString() : null;
    const body = kind === "rule"
      ? { type: "rule", minVbucks: Number(form.get("min")), maxVbucks: form.get("max") ? Number(form.get("max")) : null, mxnPerHundred: Number(form.get("rate")), effectiveFrom, effectiveUntil }
      : { type: "override", itemMainId: String(form.get("item")), amountMxnCents: Math.round(Number(form.get("amount")) * 100), effectiveFrom, effectiveUntil };
    try { await request("/api/admin/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); setMessage("Precio guardado."); event.currentTarget.reset(); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar."); }
  }
  async function toggle(type: "rule" | "override", id: string, active: boolean) {
    try { await request("/api/admin/prices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id, active }) }); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar."); }
  }
  return <div className="price-admin-grid"><form className="price-form" onSubmit={submit}><div className="price-kind"><button type="button" className={kind === "rule" ? "active" : ""} onClick={() => setKind("rule")}>Regla por rango</button><button type="button" className={kind === "override" ? "active" : ""} onClick={() => setKind("override")}>Excepción</button></div>{kind === "rule" ? <><label>PaVos mínimos<input name="min" type="number" min="1" required /></label><label>PaVos máximos <span>(vacío = sin límite)</span><input name="max" type="number" min="1" /></label><label>MXN por cada 100 paVos<input name="rate" type="number" min="0.01" step="0.01" required /></label></> : <><label>Main ID del objeto<input name="item" required /></label><label>Precio final MXN<input name="amount" type="number" min="1" step="1" required /></label></>}<label>Inicio de vigencia <span>(vacío = ahora)</span><input name="from" type="datetime-local" /></label><label>Fin de vigencia <span>(opcional)</span><input name="until" type="datetime-local" /></label><button className="primary-button">Guardar nueva versión</button>{message && <p className="notice">{message}</p>}</form><div className="price-lists"><h2>Reglas</h2>{data.rules.map((rule) => <article key={rule.id}><span>{rule.min_vbucks}–{rule.max_vbucks ?? "∞"} paVos<small>{formatValidity(rule.effective_from, rule.effective_until)}</small></span><strong>${Number(rule.mxn_per_hundred).toFixed(2)} / 100</strong><button onClick={() => void toggle("rule", rule.id, !rule.active)}>{rule.active ? "Desactivar" : "Activar"}</button></article>)}<h2>Excepciones</h2>{data.overrides.map((override) => <article key={override.id}><span>{override.main_id}<small>{formatValidity(override.effective_from, override.effective_until)}</small></span><strong>${(override.amount_mxn_cents / 100).toFixed(0)}</strong><button onClick={() => void toggle("override", override.id, !override.active)}>{override.active ? "Desactivar" : "Activar"}</button></article>)}</div></div>;
}

function formatValidity(from: string, until: string | null) {
  const start = new Date(from).toLocaleDateString("es-MX");
  return `${start} → ${until ? new Date(until).toLocaleDateString("es-MX") : "sin vencimiento"}`;
}
