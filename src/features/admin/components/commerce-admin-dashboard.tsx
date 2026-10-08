"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { SupervisorOrders } from "@/features/orders/components/supervisor-orders";
import { IdentityReviewQueue } from "@/features/admin/components/identity-review-queue";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

type Tab = "summary" | "orders" | "identities" | "carts" | "favorites" | "prices";
type Metrics = { pendingOrders: number; receiptsToReview: number; activeCarts: number; abandonedCarts: number; favorites: number };
type Cart = { id: string; status: string; updated_at: string; abandoned: boolean; estimatedAmountMxnCents: number; shopping_cart_items: { item_main_id: string }[]; validation: null | { display_name: string; platform: string; status: string }; commerce_sessions: null | { whatsapp: string | null; user_id: string | null; merged_into: string | null } };
type FavoriteDetail = { item_main_id: string; commerce_session_id: string; created_at: string; commerce_sessions: null | { user_id: string | null } };
type PriceRule = { id: string; min_vbucks: number; max_vbucks: number | null; mxn_per_hundred: number | string; active: boolean; effective_from: string; effective_until: string | null };
type PriceOverride = { id: string; main_id: string; amount_mxn_cents: number; active: boolean; effective_from: string; effective_until: string | null };
type CatalogOption = { mainId: string; name: string; type: string; imageUrl?: string | null; collaboration?: string | null };

export function CommerceAdminDashboard() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [tab, setTab] = useState<Tab>("summary");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loadedTab, setLoadedTab] = useState<Tab | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loadRequest = useRef(0);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session) throw new Error("La sesión de administrador expiró.");
    const response = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No fue posible completar la operación.");
    return body;
  }, [supabase]);

  const load = useCallback(async (activeTab: Tab) => {
    if (activeTab === "orders" || activeTab === "identities") return;
    const requestId = ++loadRequest.current;
    setMessage(null); setData(null); setLoadedTab(null);
    try {
      const response = await request(activeTab === "prices" ? "/api/admin/prices" : `/api/admin/dashboard?view=${activeTab}`);
      if (requestId === loadRequest.current) { setData(response); setLoadedTab(activeTab); }
    }
    catch (error) { if (requestId === loadRequest.current) setMessage(error instanceof Error ? error.message : "No fue posible cargar el dashboard."); }
  }, [request]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load(tab));
    return () => window.cancelAnimationFrame(frame);
  }, [load, tab]);

  return <section className="admin-dashboard">
    <header className="admin-dashboard-heading"><div><p className="eyebrow">OPERACIÓN SEGURA</p><h1>Panel de comercio</h1><p>Pedidos, intención de compra y precios desde una sola fuente.</p></div><button onClick={() => void load(tab)}>Actualizar</button></header>
    <nav className="admin-tabs" aria-label="Secciones del dashboard">{(["summary", "orders", "identities", "carts", "favorites", "prices"] as Tab[]).map((value) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{({ summary: "Resumen", orders: "Pedidos", identities: "Revisión de IDs", carts: "Carritos", favorites: "Favoritos", prices: "Precios" } as const)[value]}</button>)}</nav>
    {message && <p className="notice error">{message}</p>}
    {tab === "summary" && loadedTab === "summary" && data && <Summary metrics={data.metrics as Metrics} />}
    {tab === "orders" && <SupervisorOrders />}
    {tab === "identities" && <IdentityReviewQueue />}
    {tab === "carts" && loadedTab === "carts" && data && <Carts carts={(data.carts as Cart[] | undefined) ?? []} />}
    {tab === "favorites" && loadedTab === "favorites" && data && <Favorites ranking={(data.ranking as { itemMainId: string; count: number }[] | undefined) ?? []} favorites={(data.favorites as FavoriteDetail[] | undefined) ?? []} />}
    {tab === "prices" && loadedTab === "prices" && data && <Prices data={{ rules: (data.rules as PriceRule[] | undefined) ?? [], overrides: (data.overrides as PriceOverride[] | undefined) ?? [] }} request={request} reload={() => load("prices")} />}
  </section>;
}

function Summary({ metrics }: { metrics: Metrics }) {
  const cards = [["Pedidos activos", metrics.pendingOrders], ["Comprobantes por revisar", metrics.receiptsToReview], ["Carritos con actividad", metrics.activeCarts], ["Carritos sin actividad +24 h", metrics.abandonedCarts], ["Favoritos guardados", metrics.favorites]];
  return <div className="admin-metrics">{cards.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>;
}

function Carts({ carts }: { carts: Cart[] }) {
  return <div className="admin-data-list">{carts.length === 0 ? <p className="notice">No hay carritos activos.</p> : carts.map((cart) => <article key={cart.id} className="admin-data-card"><div><span className={`order-status-pill ${cart.abandoned ? "status-expired" : `status-${cart.status}`}`}>{cart.abandoned ? "Abandonado" : "Activo"}</span><h2>{cart.validation?.display_name ?? `Visitante ${cart.id.slice(0, 8)}`}</h2><p>{cart.validation ? `${cart.validation.platform} · ${cart.validation.status}` : "ID todavía no proporcionado"}</p></div><div><strong>{cart.shopping_cart_items.length} objetos · ${(cart.estimatedAmountMxnCents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</strong><p>{cart.shopping_cart_items.map((item) => item.item_main_id).join(", ") || "Carrito vacío"}</p><small>Actividad: {new Date(cart.updated_at).toLocaleString("es-MX")}</small></div></article>)}</div>;
}

function Favorites({ ranking, favorites }: { ranking: { itemMainId: string; count: number }[]; favorites: FavoriteDetail[] }) {
  return <div className="admin-data-list"><div className="admin-ranking"><div className="admin-table-head"><span>Objeto</span><span>Veces guardado</span></div>{ranking.length === 0 ? <p className="notice">Todavía no hay favoritos.</p> : ranking.map((item, index) => <div key={item.itemMainId}><span><b>#{index + 1}</b>{item.itemMainId}</span><strong>{item.count}</strong></div>)}</div>{favorites.length > 0 && <section className="admin-ranking"><h2>Detalle reciente</h2><div className="admin-table-head"><span>Sesión / usuario</span><span>Objeto</span></div>{favorites.slice(0, 100).map((favorite) => <div key={`${favorite.commerce_session_id}-${favorite.item_main_id}`}><span>{favorite.commerce_sessions?.user_id ? `Usuario ${favorite.commerce_sessions.user_id.slice(0, 8)}` : `Visitante ${favorite.commerce_session_id.slice(0, 8)}`}</span><strong>{favorite.item_main_id}</strong></div>)}</section>}</div>;
}

function Prices({ data, request, reload }: { data: { rules: PriceRule[]; overrides: PriceOverride[] }; request: (url: string, init?: RequestInit) => Promise<Record<string, unknown>>; reload: () => Promise<void> }) {
  const [kind, setKind] = useState<"rule" | "override">("rule");
  const [message, setMessage] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<PriceRule | null>(null);
  const [editingOverride, setEditingOverride] = useState<PriceOverride | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogOption[] | null>(null);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [collection, setCollection] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  useEffect(() => {
    if (kind !== "override" || catalogItems) return;
    let cancelled = false;
    void request("/api/catalog").then((response) => {
      if (!cancelled) setCatalogItems(Array.isArray(response.data) ? response.data as CatalogOption[] : []);
    }).catch(() => { if (!cancelled) setCatalogMessage("No fue posible cargar los objetos de la tienda."); });
    return () => { cancelled = true; };
  }, [catalogItems, kind, request]);
  const collections = useMemo(() => [...new Set((catalogItems ?? []).map((item) => item.collaboration?.trim() || "Sin colección"))].sort((left, right) => left.localeCompare(right, "es")), [catalogItems]);
  const visibleItems = useMemo(() => (catalogItems ?? []).filter((item) => !collection || (item.collaboration?.trim() || "Sin colección") === collection).sort((left, right) => left.name.localeCompare(right.name, "es")), [catalogItems, collection]);
  const overrideItemIds = useMemo(() => new Set(data.overrides.map((override) => override.main_id)), [data.overrides]);
  const selectableItems = useMemo(() => editingOverride ? visibleItems.filter((item) => item.mainId === editingOverride.main_id) : visibleItems.filter((item) => !overrideItemIds.has(item.mainId)), [editingOverride, overrideItemIds, visibleItems]);
  const catalogById = useMemo(() => new Map((catalogItems ?? []).map((item) => [item.mainId, item])), [catalogItems]);
  const selectedItem = catalogById.get(selectedItemId) ?? null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const effectiveFrom = form.get("from") ? new Date(String(form.get("from"))).toISOString() : undefined;
    const effectiveUntil = form.get("until") ? new Date(String(form.get("until"))).toISOString() : null;
    const body = kind === "rule"
      ? editingRule
        ? { action: "editRule", type: "rule", id: editingRule.id, minVbucks: Number(form.get("min")), maxVbucks: form.get("max") ? Number(form.get("max")) : null, mxnPerHundred: Number(form.get("rate")), effectiveFrom, effectiveUntil }
        : { type: "rule", minVbucks: Number(form.get("min")), maxVbucks: form.get("max") ? Number(form.get("max")) : null, mxnPerHundred: Number(form.get("rate")), effectiveFrom, effectiveUntil }
      : editingOverride
        ? { action: "editOverride", type: "override", id: editingOverride.id, amountMxnCents: Math.round(Number(form.get("amount")) * 100), effectiveFrom, effectiveUntil }
        : { type: "override", itemMainId: String(form.get("item")), amountMxnCents: Math.round(Number(form.get("amount")) * 100), effectiveFrom, effectiveUntil };
    const method = editingRule || editingOverride ? "PATCH" : "POST";
    try { await request("/api/admin/prices", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); formElement.reset(); setEditingRule(null); setEditingOverride(null); setSelectedItemId(""); setMessage(editingRule ? "Regla actualizada." : editingOverride ? "Excepción actualizada." : "Precio guardado."); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar."); }
  }
  async function toggle(type: "rule" | "override", id: string, active: boolean) {
    try { await request("/api/admin/prices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", type, id, active }) }); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar."); }
  }
  const editing = Boolean(editingRule || editingOverride);
  const effectiveFrom = editingRule?.effective_from ?? editingOverride?.effective_from ?? null;
  const effectiveUntil = editingRule?.effective_until ?? editingOverride?.effective_until ?? null;
  return <div className="price-admin-grid">
<form className="price-form" key={editingRule?.id ?? editingOverride?.id ?? "new-price"} onSubmit={submit}>
<div className="price-form-heading">
<div>
<p className="eyebrow">{editing ? "EDICIÓN" : kind === "rule" ? "TARIFA GENERAL" : "PRECIO ESPECIAL"}</p>
<h2>{editingRule ? "Editar regla" : editingOverride ? "Editar excepción" : kind === "rule" ? "Nueva regla" : "Nueva excepción"}</h2>
</div>{editing && <button type="button" className="price-cancel" onClick={() => { setEditingRule(null); setEditingOverride(null); setSelectedItemId(""); }}>Cancelar</button>}</div>
<div className="price-kind">
<button type="button" className={kind === "rule" ? "active" : ""} onClick={() => { setKind("rule"); setEditingRule(null); setEditingOverride(null); setSelectedItemId(""); }}>Regla por rango</button>
<button type="button" className={kind === "override" ? "active" : ""} onClick={() => { setKind("override"); setEditingRule(null); setEditingOverride(null); setSelectedItemId(""); }}>Excepción</button>
</div>{kind === "rule" ? <>
<label>PaVos mínimos<input name="min" type="number" min="1" required defaultValue={editingRule?.min_vbucks} />
</label>
<label>PaVos máximos <span>(vacío = sin límite)</span>
<input name="max" type="number" min="1" defaultValue={editingRule?.max_vbucks ?? ""} />
</label>
<label>MXN por cada 100 paVos<input name="rate" type="number" min="0.01" step="0.01" required defaultValue={editingRule ? Number(editingRule.mxn_per_hundred) : ""} />
</label>
</> : <>
<label>Colección<select value={collection} onChange={(event) => { setCollection(event.target.value); setSelectedItemId(""); }} disabled={!catalogItems || Boolean(editingOverride)}>
<option value="">Todas las colecciones</option>{collections.map((value) => <option key={value} value={value}>{value}</option>)}</select>
</label>
<label>Objeto<select name="item" required={!editingOverride} value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)} disabled={!catalogItems || Boolean(editingOverride) || selectableItems.length === 0}>
<option value="">{catalogItems ? selectableItems.length ? "Selecciona un objeto" : "Todos los objetos disponibles ya tienen excepción" : "Cargando objetos…"}</option>{selectableItems.map((item) => <option key={item.mainId} value={item.mainId}>{item.name} · {item.type}</option>)}</select>
</label>{selectedItem && <div className="selected-price-item">{selectedItem.imageUrl ? <Image src={selectedItem.imageUrl} alt="" width={52} height={52} unoptimized /> : <span aria-hidden="true">◇</span>}<div>
<strong>{selectedItem.name}</strong>
<small>{selectedItem.type}{selectedItem.collaboration ? ` · ${selectedItem.collaboration}` : ""}</small>
</div>
</div>}{catalogMessage && <p className="notice error">{catalogMessage}</p>}<label>Precio final MXN<input name="amount" type="number" min="1" step="1" required defaultValue={editingOverride ? editingOverride.amount_mxn_cents / 100 : ""} />
</label>
</>}<label>Inicio de vigencia <span>(vacío = ahora)</span>
<input name="from" type="datetime-local" defaultValue={toDateTimeInput(effectiveFrom)} />
</label>
<label>Fin de vigencia <span>(opcional)</span>
<input name="until" type="datetime-local" defaultValue={toDateTimeInput(effectiveUntil)} />
</label>
<button className="primary-button">{editing ? "Guardar cambios" : kind === "rule" ? "Guardar nueva versión" : "Crear excepción"}</button>
<small className="account-note">{kind === "override" ? "Cada objeto puede tener una sola excepción; puedes editarla o desactivarla." : "Una nueva versión no puede compartir rango y vigencia con una regla activa."}</small>{message && <p className="notice">{message}</p>}</form>
<div className="price-lists">
<div className="price-list-heading">
<div>
<p className="eyebrow">CONFIGURACIÓN ACTUAL</p>
<h2>Reglas por rango</h2>
</div>
<span>{data.rules.filter((rule) => rule.active).length} activas</span>
</div>{data.rules.map((rule) => <article key={rule.id}>
<span>
<b>{rule.min_vbucks}–{rule.max_vbucks ?? "∞"} paVos</b>
<small>{formatValidity(rule.effective_from, rule.effective_until)}</small>
</span>
<strong>${Number(rule.mxn_per_hundred).toFixed(2)} <small>/ 100</small>
</strong>
<div className="price-rule-actions">
<button type="button" onClick={() => { setKind("rule"); setEditingOverride(null); setEditingRule(rule); setSelectedItemId(""); }}>Editar</button>
<button type="button" onClick={() => void toggle("rule", rule.id, !rule.active)}>{rule.active ? "Desactivar" : "Activar"}</button>
</div>
</article>)}<div className="price-list-heading">
<div>
<p className="eyebrow">POR OBJETO</p>
<h2>Excepciones</h2>
</div>
<span>{data.overrides.filter((override) => override.active).length} activas</span>
</div>{data.overrides.length === 0 ? <p className="notice">Aún no hay precios especiales por objeto.</p> : data.overrides.map((override) => { const item = catalogById.get(override.main_id); return <article key={override.id}>
<span>
<b>{item?.name ?? override.main_id}</b>
<small>{item ? `${item.type} · ` : ""}{formatValidity(override.effective_from, override.effective_until)}</small>
</span>
<strong>${(override.amount_mxn_cents / 100).toFixed(0)}</strong>
<div className="price-rule-actions">
<button type="button" onClick={() => { setKind("override"); setEditingRule(null); setEditingOverride(override); setCollection(""); setSelectedItemId(override.main_id); }}>Editar</button>
<button type="button" onClick={() => void toggle("override", override.id, !override.active)}>{override.active ? "Desactivar" : "Activar"}</button>
</div>
</article>; })}</div>
</div>;
}

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function formatValidity(from: string, until: string | null) {
  const start = new Date(from).toLocaleDateString("es-MX");
  return `${start} → ${until ? new Date(until).toLocaleDateString("es-MX") : "sin vencimiento"}`;
}
