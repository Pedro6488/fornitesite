"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import type { OrderStatus } from "../domain/order";

const labels: Record<OrderStatus, string> = {
  draft: "Borrador", payment_pending: "Pago pendiente", awaiting_transfer: "Pendiente de transferencia",
  receipt_submitted: "Comprobante recibido", transfer_review: "En revisión", information_required: "Requiere información",
  paid: "Pagado", ready_to_send: "Listo para enviar", validating_delivery: "Validando entrega", delivering: "Enviando",
  reconciling: "Conciliando", delivered: "Entregado", manual_review: "Revisión manual", refund_pending: "Reembolso pendiente",
  refunded: "Reembolsado", rejected: "Declinado", expired: "Vencido", canceled: "Cancelado"
};
const nextStates: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  awaiting_transfer: ["canceled"], receipt_submitted: ["transfer_review"],
  transfer_review: ["information_required", "paid", "rejected"],
  information_required: ["rejected", "canceled"], paid: ["ready_to_send", "manual_review", "refund_pending"],
  ready_to_send: ["validating_delivery", "manual_review", "refund_pending"],
  validating_delivery: ["delivering", "manual_review", "refund_pending"], delivering: ["delivered", "reconciling", "manual_review"],
  reconciling: ["delivered", "manual_review"], manual_review: ["ready_to_send", "refund_pending"],
  refund_pending: ["refunded", "manual_review"]
};

type Order = { id: string; created_at: string; customer_email: string | null; epic_display_name: string; recipient_platform: string; contact_whatsapp: string; amount_mxn_cents: number; status: OrderStatus; order_items: { item_name: string; quantity: number }[]; paymentTicketUrl: string | null; history: { action: string; created_at: string; after_data: { status?: string } | null }[] };

export function SupervisorOrders() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [message, setMessage] = useState("Cargando pedidos…");
  const load = useCallback(async () => {
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session) return setMessage("Inicia sesión con una cuenta administradora.");
    const response = await fetch("/api/admin/orders", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error);
    setOrders(body.orders); setMessage(body.orders.length ? "" : "No hay pedidos todavía.");
  }, [supabase]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  async function update(id: string, status: OrderStatus) {
    const session = (await supabase?.auth.getSession())?.data.session; if (!session) return;
    const requiresNotes = ["information_required", "rejected", "canceled"].includes(status);
    const notes = requiresNotes ? window.prompt("Nota para la auditoría")?.trim() : undefined;
    if (requiresNotes && (!notes || notes.length < 3)) return setMessage("Escribe una nota de al menos 3 caracteres para esta transición.");
    const response = await fetch(`/api/admin/orders/${id}/status`, { method: "PATCH", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status, notes }) });
    if (!response.ok) return setMessage((await response.json()).error);
    await load();
  }
  const visible = orders.filter((order) => (statusFilter === "all" || order.status === statusFilter) && `${order.id} ${order.epic_display_name} ${order.contact_whatsapp} ${order.order_items.map((item) => item.item_name).join(" ")}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="supervisor-orders">
    <div className="admin-toolbar"><input type="search" placeholder="Buscar por pedido, ID, WhatsApp u objeto" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | "all")}><option value="all">Todos los estados</option>{(Object.keys(labels) as OrderStatus[]).map((status) => <option value={status} key={status}>{labels[status]}</option>)}</select><button className="secondary-button" onClick={() => void load()}>Actualizar</button></div>
    {message && <p className="notice">{message}</p>}
    {visible.map((order) => <article className="supervisor-order" key={order.id}>
      <div><span className={`order-status-pill status-${order.status}`}>{labels[order.status]}</span><h2>#{order.id.slice(0, 8).toUpperCase()}</h2><p>{new Date(order.created_at).toLocaleString("es-MX")}</p><p>{order.order_items.map((item) => item.item_name).join(", ")}</p></div>
      <div><strong>${(order.amount_mxn_cents / 100).toFixed(2)} MXN</strong><p>{order.epic_display_name} · {order.recipient_platform}</p><p>{order.customer_email || "Sin correo"} · {order.contact_whatsapp}</p>{order.paymentTicketUrl && <a className="ticket-link" href={order.paymentTicketUrl} target="_blank" rel="noreferrer">Ver comprobante ↗</a>}{order.history.length > 0 && <details className="order-history"><summary>Historial ({order.history.length})</summary>{order.history.slice(0, 8).map((event, index) => <p key={`${event.created_at}-${index}`}><span>{event.after_data?.status ? labels[event.after_data.status as OrderStatus] ?? event.after_data.status : event.action}</span><small>{new Date(event.created_at).toLocaleString("es-MX")}</small></p>)}</details>}</div>
      <div className="admin-order-actions">{(nextStates[order.status] ?? []).map((status) => <button key={status} onClick={() => void update(order.id, status)}>{labels[status]}</button>)}</div>
    </article>)}
  </div>;
}
