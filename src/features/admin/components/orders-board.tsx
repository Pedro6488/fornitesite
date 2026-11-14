"use client";

import Link from "next/link";
import { useState } from "react";
import { FileCheck2, FileX2, RefreshCw, Search } from "lucide-react";
import type { OrderStatus } from "@/features/orders/domain/order";
import { formatAge, formatOrderMoney, shortOrderId } from "../application/format";
import { ORDER_QUEUES, ORDER_STATUS_LABELS, primaryActionOf, type OrderQueueId } from "../application/order-queues";
import { AdminPageHeader, useDeliveryMode } from "./admin-shell";
import { OrderActionNotice, useOrderActions } from "./order-actions";
import { useAdminData } from "./use-admin-request";

type OrderRow = {
  id: string; created_at: string; updated_at: string | null; customer_email: string | null; epic_display_name: string;
  recipient_platform: string; contact_whatsapp: string | null; amount_mxn_cents: number; currency?: "MXN" | "USD"; amount_usd_cents?: number | null; status: OrderStatus;
  order_items: { item_name: string; item_image_url: string | null; quantity: number }[]; hasReceipt: boolean;
};
type OrdersResponse = { orders: OrderRow[]; counts: Record<OrderQueueId, number>; hasMore: boolean };

const REFRESH_MS = 60_000;
const CLOSED_PAGE_SIZE = 50;

function isQueue(value: string | undefined): value is OrderQueueId {
  return ORDER_QUEUES.some((queue) => queue.id === value);
}

type ClosedResult = "all" | "delivered" | "other";
const CLOSED_RESULTS: readonly { id: ClosedResult; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "delivered", label: "Entregados" },
  { id: "other", label: "No completados" },
];

const ZONE = "America/Mexico_City";
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date(iso));
const closedTime = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { timeZone: ZONE, hour: "2-digit", minute: "2-digit" });

/** «Hoy», «Ayer» o la fecha, en hora de Ciudad de México. */
function dayHeading(key: string) {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Hoy";
  if (key === yesterday) return "Ayer";
  const label = new Date(`${key}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function OrdersBoard({ initialQueue }: { initialQueue?: string }) {
  const [queue, setQueue] = useState<OrderQueueId>(isQueue(initialQueue) ? initialQueue : "payment");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(CLOSED_PAGE_SIZE);
  const [result, setResult] = useState<ClosedResult>("all");
  const closed = queue === "closed";

  const parameters = new URLSearchParams({ queue });
  if (closed) {
    parameters.set("limit", String(limit));
    parameters.set("result", result);
    if (from) parameters.set("from", from);
    if (to) parameters.set("to", to);
  }
  const { data, error, loading, reload } = useAdminData<OrdersResponse>(`/api/admin/orders?${parameters}`, { refreshMs: closed ? undefined : REFRESH_MS });
  const actions = useOrderActions({ reload });
  const mode = useDeliveryMode();
  const current = ORDER_QUEUES.find((entry) => entry.id === queue)!;

  function choose(next: OrderQueueId) {
    setQueue(next);
    setQuery("");
    setLimit(CLOSED_PAGE_SIZE);
    // La URL refleja la cola para poder compartirla o volver con el botón atrás.
    window.history.replaceState(null, "", `/admin/pedidos?cola=${next}`);
  }

  const needle = query.trim().toLowerCase();
  // Mientras llega otra cola no se muestran los pedidos de la anterior.
  const loaded = data?.orders.every((order) => current.statuses.includes(order.status)) ? data.orders : [];
  const visible = loaded.filter((order) => !needle
    || `${order.id} ${order.epic_display_name} ${order.contact_whatsapp ?? ""} ${order.customer_email ?? ""} ${order.order_items.map((item) => item.item_name).join(" ")}`.toLowerCase().includes(needle));
  // Cerrados se agrupan por el día en que se cerraron (ya vienen del más reciente al más antiguo).
  const groups: { key: string; heading: string | null; orders: OrderRow[] }[] = [];
  for (const order of visible) {
    const key = closed ? dayKey(order.updated_at ?? order.created_at) : "all";
    const last = groups.at(-1);
    if (last?.key === key) last.orders.push(order);
    else groups.push({ key, heading: closed ? dayHeading(key) : null, orders: [order] });
  }

  return <>
    <AdminPageHeader title="Pedidos" lead="Cada pedido está en una sola cola, según lo que le falta."
      actions={<button type="button" className="ac-ghost" disabled={loading} onClick={() => void reload()}><RefreshCw aria-hidden="true" size={15} />{loading ? "Actualizando…" : "Actualizar"}</button>} />

    <div className="ac-queue-tabs" role="tablist" aria-label="Colas de pedidos">
      {ORDER_QUEUES.map((entry) => <button key={entry.id} type="button" role="tab" aria-selected={queue === entry.id} onClick={() => choose(entry.id)}>
        {entry.label}{entry.id !== "closed" && data && <b>{data.counts[entry.id]}</b>}
      </button>)}
    </div>
    <p className="ac-queue-hint">{current.hint}</p>

    <div className="ac-toolbar">
      <label className="ac-search"><Search aria-hidden="true" size={16} /><input type="search" aria-label="Buscar en esta cola" placeholder="Buscar por pedido, ID de Epic, WhatsApp u objeto" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {closed && <>
        <div className="ac-segmented" role="group" aria-label="Resultado">
          {CLOSED_RESULTS.map((entry) => <button key={entry.id} type="button" aria-pressed={result === entry.id} onClick={() => { setResult(entry.id); setLimit(CLOSED_PAGE_SIZE); }}>{entry.label}</button>)}
        </div>
        <label className="ac-date">Cerrado desde<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="ac-date">Hasta<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
      </>}
    </div>

    <OrderActionNotice notice={actions.notice} />
    {error && <p className="ac-notice is-error" role="alert">{error}</p>}
    {!data && !error && <p className="ac-notice">Cargando pedidos…</p>}
    {data && visible.length === 0 && !loading && <p className="ac-empty">{needle ? "Ningún pedido de esta cola coincide con la búsqueda." : closed ? "No hay pedidos cerrados en estas fechas." : "No hay pedidos en esta cola."}</p>}

    {groups.map((group) => <section key={group.key} className="ac-order-group" aria-label={group.heading ?? undefined}>
    {group.heading && <h2 className="ac-day-heading">{group.heading}<small>{group.orders.length} {group.orders.length === 1 ? "pedido" : "pedidos"}</small></h2>}
    <ul className={`ac-orders${loading ? " is-refreshing" : ""}`}>
      {group.orders.map((order) => {
        const primary = primaryActionOf(order.status, mode);
        const units = order.order_items.reduce((total, item) => total + item.quantity, 0);
        const closedAt = order.updated_at ?? order.created_at;
        return <li key={order.id}>
          <Link className="ac-order-main" href={`/admin/pedidos/${order.id}`}>
            <span className="ac-order-top"><span className={`ac-pill status-${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span><b>{shortOrderId(order.id)}</b>
              {closed
                ? <time dateTime={closedAt}>a las {closedTime(closedAt)} · creado {new Date(order.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: ZONE })}</time>
                : <time dateTime={order.created_at}>Creado {formatAge(order.created_at)}</time>}</span>
            <strong>{order.epic_display_name}</strong>
            <span className="ac-order-items">{order.order_items.map((item) => `${item.quantity}× ${item.item_name}`).join(" · ") || "Sin objetos"}</span>
            <span className="ac-order-meta">
              {units} {units === 1 ? "objeto" : "objetos"}
              {queue === "payment" && (order.hasReceipt
                ? <span className="ac-flag is-ok"><FileCheck2 aria-hidden="true" size={14} />Con comprobante</span>
                : <span className="ac-flag"><FileX2 aria-hidden="true" size={14} />Sin comprobante todavía</span>)}
            </span>
          </Link>
          <div className="ac-order-side">
            <strong>{formatOrderMoney(order)}</strong>
            {primary && <button type="button" className={order.hasReceipt || primary.kind !== "status" || queue !== "payment" ? "ac-primary" : "ac-secondary"} disabled={actions.busyId === order.id} onClick={() => actions.ask(order, primary)}>
              {actions.busyId === order.id ? "Guardando…" : primary.label}
            </button>}
            <Link className="ac-link" href={`/admin/pedidos/${order.id}`}>Abrir pedido</Link>
          </div>
        </li>;
      })}
    </ul>
    </section>)}

    {closed && data?.hasMore && !needle && <button type="button" className="ac-ghost ac-more-button" disabled={loading} onClick={() => setLimit((value) => value + CLOSED_PAGE_SIZE)}>{loading ? "Cargando…" : "Cargar más pedidos"}</button>}
    {actions.modal}
  </>;
}
