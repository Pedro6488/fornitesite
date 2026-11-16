"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { AdminPageHeader } from "./admin-shell";
import { useAdminData, useAdminRequest } from "./use-admin-request";

type Cart = { id: string; status: string; updated_at: string; abandoned: boolean; estimatedAmountMxnCents: number; shopping_cart_items: { item_main_id: string }[]; validation: null | { display_name: string; platform: string; status: string }; commerce_sessions: null | { whatsapp: string | null; user_id: string | null; merged_into: string | null } };
type FavoriteDetail = { item_main_id: string; itemName: string; commerce_session_id: string; created_at: string; commerce_sessions: null | { user_id: string | null } };
type PriceRule = { id: string; min_vbucks: number; max_vbucks: number | null; mxn_per_hundred: number | string; active: boolean; effective_from: string; effective_until: string | null };
type PriceOverride = { id: string; main_id: string; amount_mxn_cents: number; active: boolean; effective_from: string; effective_until: string | null };
type CatalogOption = { mainId: string; name: string; type: string; imageUrl?: string | null; collaboration?: string | null };
type CustomerRankingEntry = { recipientName: string; customerEmail: string | null; deliveredOrders: number };
type DeliveryReference = { id: string; recipientName: string; recipientId: string; comment: string | null; createdAt: string; imageUrls: string[]; items: { item_name: string; item_image_url: string | null; quantity: number }[] };

/**
 * Secciones de «Tienda» de la consola. Cada una carga sus propios datos y vive en su propia ruta.
 */
function StoreSection({ title, lead, error, loading, ready, loadingText, reload, children }: {
  title: string; lead: string; error: string | null; loading: boolean; ready: boolean; loadingText: string; reload: () => Promise<void>; children: ReactNode;
}) {
  return <>
    <AdminPageHeader title={title} lead={lead} actions={<button type="button" className="ac-ghost" disabled={loading} onClick={() => void reload()}><RefreshCw aria-hidden="true" size={15} />{loading ? "Actualizando…" : "Actualizar"}</button>} />
    {error && <p className="ac-notice is-error" role="alert">{error}</p>}
    {!ready && !error && <p className="ac-notice">{loadingText}</p>}
    {ready && <div className="ac-legacy">{children}</div>}
  </>;
}

export function AdminCarts({ focusCartId }: { focusCartId?: string | null }) {
  const { data, error, loading, reload } = useAdminData<{ carts?: Cart[] }>("/api/admin/dashboard?view=carts");
  return <StoreSection title="Carritos" lead="Carritos activos y abandonados, con su valor estimado." error={error} loading={loading} ready={Boolean(data)} loadingText="Cargando carritos…" reload={reload}>
    <Carts carts={data?.carts ?? []} focusCartId={focusCartId ?? null} />
  </StoreSection>;
}

export function AdminFavorites() {
  const { data, error, loading, reload } = useAdminData<{ ranking?: { itemMainId: string; itemName: string; count: number }[]; favorites?: FavoriteDetail[] }>("/api/admin/dashboard?view=favorites");
  return <StoreSection title="Favoritos" lead="Los objetos que más guardan los clientes." error={error} loading={loading} ready={Boolean(data)} loadingText="Cargando favoritos…" reload={reload}>
    <Favorites ranking={data?.ranking ?? []} favorites={data?.favorites ?? []} />
  </StoreSection>;
}

export function AdminPrices() {
  const request = useAdminRequest();
  const { data, error, loading, reload } = useAdminData<{ rules?: PriceRule[]; overrides?: PriceOverride[] }>("/api/admin/prices");
  return <StoreSection title="Precios" lead="Tarifa por rango de paVos y precios especiales por objeto." error={error} loading={loading} ready={Boolean(data)} loadingText="Cargando precios…" reload={reload}>
    <Prices data={{ rules: data?.rules ?? [], overrides: data?.overrides ?? [] }} request={request} reload={reload} />
  </StoreSection>;
}

export function AdminCustomers() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "" });
  const parameters = new URLSearchParams({ view: "customers" });
  if (applied.from) parameters.set("from", applied.from);
  if (applied.to) parameters.set("to", applied.to);
  const { data, error, loading, reload } = useAdminData<{ customers?: CustomerRankingEntry[] }>(`/api/admin/dashboard?${parameters}`);
  return <StoreSection title="Clientes" lead="Destinatarios ordenados por entregas recibidas." error={error} loading={loading} ready loadingText="" reload={reload}>
    <Customers customers={data && !loading ? data.customers ?? [] : null} from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      reload={async () => { if (applied.from === from && applied.to === to) await reload(); else setApplied({ from, to }); }} />
  </StoreSection>;
}

export function AdminReferences() {
  const { data, error, loading, reload } = useAdminData<{ references?: DeliveryReference[] }>("/api/admin/references");
  return <StoreSection title="Referencias" lead="Evidencias que envían los clientes después de recibir su regalo." error={error} loading={loading} ready loadingText="" reload={reload}>
    <References references={data ? data.references ?? [] : null} />
  </StoreSection>;
}

function References({ references }: { references: DeliveryReference[] | null }) {
  return <section className="admin-references">
    <header><p className="eyebrow">ENTREGAS CONFIRMADAS</p><h2>Referencias de clientes</h2><p>Aquí aparecen las evidencias enviadas después de recibir sus objetos.</p></header>
    {references === null ? <p className="notice">Cargando referencias…</p> : references.length === 0 ? <p className="notice">Aún no hay referencias enviadas.</p> : <div className="admin-reference-list">
      {references.map((reference) => <article key={reference.id}>
        <header><div><small>ID QUE RECIBIÓ</small><strong>{reference.recipientName}</strong></div><time dateTime={reference.createdAt}>{new Date(reference.createdAt).toLocaleString("es-MX")}</time></header>
        <div className="admin-reference-content">
          {reference.imageUrls.length ? <div className="admin-reference-gallery">{reference.imageUrls.map((imageUrl, index) => <a key={imageUrl} href={imageUrl} target="_blank" rel="noreferrer"><img src={imageUrl} alt={`Evidencia ${index + 1} de ${reference.recipientName}`} />Ver imagen {index + 1}</a>)}</div> : <span className="admin-reference-empty">Sin imágenes</span>}
          <div><small>OBJETOS RECIBIDOS</small><ul>{reference.items.map((item, index) => <li key={`${item.item_name}-${index}`}>{item.quantity}× {item.item_name}</li>)}</ul>{reference.comment && <blockquote>“{reference.comment}”</blockquote>}</div>
        </div>
      </article>)}
    </div>}
  </section>;
}

function Customers({ customers, from, to, onFromChange, onToChange, reload }: { customers: CustomerRankingEntry[] | null; from: string; to: string; onFromChange: (value: string) => void; onToChange: (value: string) => void; reload: () => Promise<void> }) {
  const rankLabel = (index: number) => index === 0 ? "1er lugar" : index === 1 ? "2do lugar" : index === 2 ? "3er lugar" : String(index + 1);

  return <section className="admin-customers">
    <header className="admin-customers-heading"><div><p className="eyebrow">CLIENTES RECURRENTES</p><h2>Ranking por entregas recibidas</h2><p>Solo se cuentan pedidos con estado Entregado.</p></div></header>
    <form className="admin-customer-filters" onSubmit={(event) => { event.preventDefault(); void reload(); }}>
      <label>Desde<input type="date" value={from} max={to || undefined} onChange={(event) => onFromChange(event.target.value)} /></label>
      <label>Hasta<input type="date" value={to} min={from || undefined} onChange={(event) => onToChange(event.target.value)} /></label>
      <button className="secondary-button" type="submit">Actualizar ranking</button>
    </form>
    {customers === null ? <p className="notice">Cargando clientes…</p> : customers.length === 0 ? <p className="notice">No hay pedidos entregados en este periodo.</p> : <div className="admin-ranking admin-customer-ranking">
      {customers.map((customer, index) => <article key={customer.recipientName}>
        <span className="admin-customer-place">{rankLabel(index)}</span>
        <div><small>Destinatario de Epic</small><strong>{customer.recipientName}</strong></div>
        <div><small>Correo registrado</small><span>{customer.customerEmail ?? "Sin correo registrado"}</span></div>
        <b>{customer.deliveredOrders} {customer.deliveredOrders === 1 ? "compra recibida" : "compras recibidas"}</b>
      </article>)}
    </div>}
  </section>;
}

function Carts({ carts, focusCartId }: { carts: Cart[]; focusCartId: string | null }) {
  return <div className="admin-data-list">{carts.length === 0 ? <p className="notice">No hay carritos activos.</p> : carts.map((cart) => <article key={cart.id} className={`admin-data-card ${cart.id === focusCartId ? "admin-data-card-focus" : ""}`}><div><span className={`order-status-pill ${cart.abandoned ? "status-expired" : `status-${cart.status}`}`}>{cart.abandoned ? "Abandonado" : "Activo"}</span><h2>{cart.validation?.display_name ?? `Visitante ${cart.id.slice(0, 8)}`}</h2><p>{cart.validation ? `${cart.validation.platform} · ${cart.validation.status}` : "ID todavía no proporcionado"}</p></div><div><strong>{cart.shopping_cart_items.length} objetos · ${(cart.estimatedAmountMxnCents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</strong><p>{cart.shopping_cart_items.map((item) => item.item_main_id).join(", ") || "Carrito vacío"}</p><small>Actividad: {new Date(cart.updated_at).toLocaleString("es-MX")}</small></div></article>)}</div>;
}

function Favorites({ ranking, favorites }: { ranking: { itemMainId: string; itemName: string; count: number }[]; favorites: FavoriteDetail[] }) {
  return <div className="admin-data-list"><section className="admin-favorites-panel"><header><div><p className="eyebrow">POPULARIDAD</p><h2>Objetos más guardados</h2></div><span>{ranking.reduce((total, item) => total + item.count, 0)} favoritos</span></header>{ranking.length === 0 ? <p className="notice">Todavía no hay favoritos.</p> : <div className="favorite-ranking-list">{ranking.map((item, index) => <article key={item.itemMainId}><span className="favorite-rank">#{index + 1}</span><span><strong title={item.itemMainId}>{item.itemName}</strong><small>{item.itemMainId}</small></span><b>{item.count}</b></article>)}</div>}</section>{favorites.length > 0 && <section className="admin-favorites-panel"><header><div><p className="eyebrow">ACTIVIDAD</p><h2>Detalle reciente</h2></div><span>{Math.min(favorites.length, 100)} recientes</span></header><div className="favorite-detail-list">{favorites.slice(0, 100).map((favorite) => <article key={`${favorite.commerce_session_id}-${favorite.item_main_id}`}><div><small>Usuario o sesión</small><strong>{favorite.commerce_sessions?.user_id ? `Usuario ${favorite.commerce_sessions.user_id.slice(0, 8)}` : `Visitante ${favorite.commerce_session_id.slice(0, 8)}`}</strong></div><div><small>Objeto guardado</small><strong title={favorite.item_main_id}>{favorite.itemName}</strong><em>{favorite.item_main_id}</em></div></article>)}</div></section>}</div>;
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
