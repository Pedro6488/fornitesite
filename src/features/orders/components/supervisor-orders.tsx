"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, ChevronDown, FileCheck2, PackageCheck, RefreshCw, Search, Send, UserRoundCheck } from "lucide-react";
import { CommerceSheet } from "@/features/commerce/components/commerce-sheet";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import { SystemActionBar } from "@/shared/components/system-action-bar";
import type { OrderStatus } from "../domain/order";

const labels: Record<OrderStatus, string> = {
  draft: "Borrador", payment_pending: "Pago pendiente", awaiting_transfer: "Pendiente de transferencia",
  receipt_submitted: "Comprobante recibido", transfer_review: "En revisión", information_required: "Requiere información",
  paid: "Pagado", ready_to_send: "Listo para enviar", validating_delivery: "Validando entrega", delivering: "Enviando",
  reconciling: "Conciliando", delivered: "Entregado", manual_review: "Revisión manual", refund_pending: "Reembolso pendiente",
  refunded: "Reembolsado", rejected: "Declinado", expired: "Vencido", canceled: "Cancelado"
};

const actionLabels: Partial<Record<OrderStatus, string>> = {
  awaiting_transfer: "Solicitar transferencia",
  transfer_review: "Revisar comprobante",
  information_required: "Solicitar información",
  paid: "Confirmar pago",
  ready_to_send: "Preparar entrega",
  validating_delivery: "Validar entrega",
  delivering: "Iniciar envío",
  reconciling: "Conciliar entrega",
  delivered: "Marcar como entregado",
  refund_pending: "Iniciar reembolso",
  refunded: "Confirmar reembolso",
  rejected: "Rechazar pago",
  canceled: "Cancelar pedido"
};

const nextStates: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  awaiting_transfer: ["paid", "canceled"],
  receipt_submitted: ["paid", "transfer_review"],
  transfer_review: ["paid", "information_required", "rejected"],
  information_required: ["paid", "rejected", "canceled"],
  paid: ["ready_to_send", "manual_review", "refund_pending"],
  ready_to_send: ["validating_delivery", "manual_review", "refund_pending"],
  validating_delivery: ["delivering", "manual_review", "refund_pending"],
  delivering: ["delivered", "reconciling", "manual_review"],
  reconciling: ["delivered", "manual_review"],
  manual_review: ["awaiting_transfer", "canceled"],
  refund_pending: ["refunded", "manual_review"]
};

const progressByStatus: Partial<Record<OrderStatus, number>> = {
  manual_review: 0,
  awaiting_transfer: 1,
  receipt_submitted: 1,
  transfer_review: 1,
  information_required: 1,
  paid: 2,
  ready_to_send: 2,
  validating_delivery: 2,
  delivering: 3,
  reconciling: 3,
  delivered: 4
};

const progressSteps = [
  { label: "ID", icon: UserRoundCheck },
  { label: "Pago", icon: BadgeCheck },
  { label: "Preparación", icon: PackageCheck },
  { label: "Envío", icon: Send },
  { label: "Entregado", icon: FileCheck2 }
] as const;

type OrderItem = { item_main_id: string; item_name: string; item_image_url: string | null; vbucks_price: number; quantity: number; unit_amount_mxn_cents: number };
type HistoryEvent = { action: string; created_at: string; after_data: { status?: string; notes?: string } | null };
type Order = {
  id: string;
  created_at: string;
  customer_email: string | null;
  epic_display_name: string;
  epic_account_id: string;
  recipient_platform: string;
  contact_whatsapp: string;
  amount_mxn_cents: number;
  status: OrderStatus;
  order_items: OrderItem[];
  paymentTicketUrl: string | null;
  history: HistoryEvent[];
};

const formatMoney = (cents: number) => (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function SupervisorOrders() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [message, setMessage] = useState("Cargando pedidos…");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session) return setMessage("Inicia sesión con una cuenta administradora.");
    const response = await fetch("/api/admin/orders", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error);
    setOrders(body.orders);
    setMessage(body.orders.length ? "" : "No hay pedidos todavía.");
  }, [supabase]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  async function update(order: Order, status: OrderStatus) {
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session) return;
    if (status === "paid" && !window.confirm(`¿Confirmas que recibiste ${formatMoney(order.amount_mxn_cents)} del pedido #${order.id.slice(0, 8).toUpperCase()}?`)) return;
    const requiresNotes = ["information_required", "rejected", "canceled"].includes(status);
    const notes = requiresNotes
      ? window.prompt("Nota para la auditoría")?.trim()
      : status === "paid" ? "Pago confirmado manualmente por el administrador." : undefined;
    if (requiresNotes && (!notes || notes.length < 3)) return setMessage("Escribe una nota de al menos 3 caracteres para esta transición.");
    setUpdatingId(order.id);
    const response = await fetch(`/api/admin/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes })
    });
    setUpdatingId(null);
    if (!response.ok) return setMessage((await response.json()).error);
    setMessage(status === "paid" ? "Pago confirmado. El pedido ya puede prepararse para entrega." : "Estado actualizado correctamente.");
    await load();
  }

  const visible = orders.filter((order) =>
    (statusFilter === "all" || order.status === statusFilter)
    && `${order.id} ${order.epic_display_name} ${order.epic_account_id} ${order.contact_whatsapp} ${order.order_items.map((item) => item.item_name).join(" ")}`.toLowerCase().includes(query.toLowerCase())
  );

  return <div className="supervisor-orders">
    <div className="admin-toolbar"><label className="admin-search"><Search aria-hidden="true" size={17} /><input type="search" aria-label="Buscar pedidos" placeholder="Buscar por pedido, ID, WhatsApp u objeto" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="select-control"><select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | "all")}><option value="all">Todos los estados</option>{(Object.keys(labels) as OrderStatus[]).map((status) => <option value={status} key={status}>{labels[status]}</option>)}</select><ChevronDown aria-hidden="true" size={17} /></span><button className="secondary-button" onClick={() => void load()}><RefreshCw aria-hidden="true" size={16} />Actualizar</button></div>
    {message && <p className="notice">{message}</p>}
    {visible.map((order) => {
      const progress = progressByStatus[order.status] ?? -1;
      const actions = nextStates[order.status] ?? [];
      return <article className="supervisor-order" key={order.id}>
        <header className="supervisor-order-heading"><div><span className={`order-status-pill status-${order.status}`}>{labels[order.status]}</span><h2>#{order.id.slice(0, 8).toUpperCase()}</h2><p>{new Date(order.created_at).toLocaleString("es-MX")}</p></div><div><strong>{formatMoney(order.amount_mxn_cents)}</strong><span>{order.order_items.length} {order.order_items.length === 1 ? "objeto" : "objetos"}</span></div></header>
        <ol className="admin-order-progress" aria-label="Progreso del pedido">{progressSteps.map((step, index) => { const Icon = step.icon; return <li key={step.label} className={index < progress ? "complete" : index === progress ? "active" : ""}><span><Icon aria-hidden="true" size={15} /></span><small>{step.label}</small></li>; })}</ol>
        <button type="button" className="admin-order-detail-trigger" onClick={() => setSelectedOrder(order)}>Ver operación completa <span aria-hidden="true">↗</span></button>
        {actions.length > 0 && <SystemActionBar className="admin-order-actions" variant="contained">{actions.map((status) => <button className={status === "paid" || status === "delivered" ? "primary" : status === "canceled" || status === "rejected" ? "danger" : ""} key={status} disabled={updatingId === order.id} onClick={() => void update(order, status)}>{updatingId === order.id ? "Actualizando…" : actionLabels[status] ?? labels[status]}</button>)}</SystemActionBar>}
      </article>;
    })}
    <CommerceSheet open={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} titleId="admin-order-modal-title" eyebrow="OPERACIÓN DEL PEDIDO" title={selectedOrder ? `Pedido #${selectedOrder.id.slice(0, 8).toUpperCase()}` : "Detalle del pedido"} description={selectedOrder ? `${labels[selectedOrder.status]} · ${formatMoney(selectedOrder.amount_mxn_cents)}` : undefined} className="admin-order-sheet">
      {selectedOrder && <div className="admin-order-modal-content">
        <div className="admin-order-detail-grid">
          <section><p className="eyebrow">ENTREGA</p><h3>{selectedOrder.epic_display_name}</h3><dl><div><dt>Plataforma</dt><dd>{selectedOrder.recipient_platform}</dd></div><div><dt>ID interno</dt><dd>{selectedOrder.epic_account_id}</dd></div><div><dt>WhatsApp</dt><dd>{selectedOrder.contact_whatsapp}</dd></div><div><dt>Correo</dt><dd>{selectedOrder.customer_email || "Sin correo"}</dd></div></dl></section>
          <section><p className="eyebrow">PRODUCTOS A ENTREGAR</p><div className="admin-order-items">{selectedOrder.order_items.map((item, index) => <button type="button" className="admin-order-item" key={`${item.item_main_id}-${index}`} onClick={() => { setSelectedOrder(null); setSelectedItem(item); }}><span className="admin-order-item-image">{item.item_image_url ? <Image src={item.item_image_url} alt="" fill sizes="48px" /> : <b aria-hidden="true">{item.item_name.slice(0, 1)}</b>}</span><span className="admin-order-item-copy"><strong>{item.item_name}</strong><small>{item.quantity}× · ◉ {item.vbucks_price.toLocaleString("es-MX")} paVos</small></span><span className="admin-order-item-price">{formatMoney(item.unit_amount_mxn_cents * item.quantity)}<small>Ver objeto</small></span></button>)}</div><div className={`admin-payment-proof ${selectedOrder.paymentTicketUrl ? "received" : ""}`}><FileCheck2 aria-hidden="true" size={18} /><span><strong>{selectedOrder.paymentTicketUrl ? "Comprobante recibido" : "Pago confirmado por operación"}</strong><small>{selectedOrder.paymentTicketUrl ? "Archivo enviado por el cliente" : "El administrador puede confirmar el pago sin archivo"}</small></span>{selectedOrder.paymentTicketUrl && <a href={selectedOrder.paymentTicketUrl} target="_blank" rel="noreferrer">Abrir ↗</a>}</div></section>
        </div>
        {selectedOrder.history.length > 0 && <div className="admin-order-history"><p className="eyebrow">HISTORIAL</p>{selectedOrder.history.slice(0, 12).map((event, index) => <div key={`${event.created_at}-${index}`}><p><span>{event.after_data?.status ? labels[event.after_data.status as OrderStatus] ?? event.after_data.status : event.action}</span><small>{new Date(event.created_at).toLocaleString("es-MX")}</small></p>{event.after_data?.notes && <small className="admin-order-history-note">{event.after_data.notes}</small>}</div>)}</div>}
      </div>}
    </CommerceSheet>
    <CommerceSheet open={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} titleId="admin-product-title" eyebrow="PRODUCTO A ENTREGAR" title={selectedItem?.item_name ?? "Detalle del producto"} description="Verifica visualmente el objeto antes de preparar la entrega." className="admin-product-sheet">
      {selectedItem && <div className="admin-product-preview"><div className="admin-product-preview-image">{selectedItem.item_image_url ? <Image src={selectedItem.item_image_url} alt={selectedItem.item_name} fill sizes="(max-width: 600px) 90vw, 420px" /> : <span aria-hidden="true">{selectedItem.item_name.slice(0, 1)}</span>}</div><dl><div><dt>Cantidad</dt><dd>{selectedItem.quantity}</dd></div><div><dt>Precio unitario</dt><dd>{formatMoney(selectedItem.unit_amount_mxn_cents)}</dd></div><div><dt>Precio en Fortnite</dt><dd>◉ {selectedItem.vbucks_price.toLocaleString("es-MX")} paVos</dd></div><div><dt>ID del objeto</dt><dd>{selectedItem.item_main_id}</dd></div></dl><Link className="primary-button" href={`/objetos/${encodeURIComponent(selectedItem.item_main_id)}`} target="_blank">Abrir detalle del producto ↗</Link></div>}
    </CommerceSheet>
  </div>;
}
