"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, ChevronDown, FileCheck2, PackageCheck, RefreshCw, Search, Send, UserRoundCheck } from "lucide-react";
import { CommerceSheet } from "@/features/commerce/components/commerce-sheet";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import { SystemActionBar } from "@/shared/components/system-action-bar";
import { AdminActionModal } from "@/shared/components/admin-action-modal";
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

const paidOrderStatuses: readonly OrderStatus[] = ["paid", "ready_to_send", "validating_delivery", "delivering", "reconciling", "delivered"];

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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [message, setMessage] = useState("Cargando pedidos…");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const loadRequest = useRef(0);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [pendingAction, setPendingAction] = useState<{ order: Order; status: OrderStatus } | null>(null);

  const load = useCallback(async () => {
    const requestId = ++loadRequest.current;
    setLoading(true);
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session) { setMessage("Inicia sesión con una cuenta administradora."); setLoading(false); return; }
    try {
      const parameters = new URLSearchParams();
      if (fromDate) parameters.set("from", fromDate);
      if (toDate) parameters.set("to", toDate);
      const response = await fetch(`/api/admin/orders${parameters.size ? `?${parameters}` : ""}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "No fue posible cargar los pedidos.");
      if (requestId !== loadRequest.current) return;
      setOrders(body.orders);
      setMessage(body.orders.length ? "" : "No hay pedidos todavía.");
    } catch (error) {
      if (requestId === loadRequest.current) setMessage(error instanceof Error ? error.message : "No fue posible cargar los pedidos.");
    } finally {
      if (requestId === loadRequest.current) setLoading(false);
    }
  }, [fromDate, supabase, toDate]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  async function update(order: Order, status: OrderStatus, notes?: string) {
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session) return;
    setUpdatingId(order.id);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "No fue posible actualizar el pedido.");
      setOrders((current) => current.map((candidate) => candidate.id === order.id ? { ...candidate, status } : candidate));
      if (selectedOrder?.id === order.id) setSelectedOrder((current) => current ? { ...current, status } : current);
      setMessage(status === "paid" ? "Pago confirmado. El pedido ya puede prepararse para entrega." : "Estado actualizado correctamente.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible actualizar el pedido.");
    } finally {
      setUpdatingId(null);
    }
  }

  const visible = orders.filter((order) =>
    (statusFilter === "all" || order.status === statusFilter)
    && `${order.id} ${order.epic_display_name} ${order.epic_account_id} ${order.contact_whatsapp} ${order.order_items.map((item) => item.item_name).join(" ")}`.toLowerCase().includes(query.toLowerCase())
  );
  const soldMxnCents = visible.filter((order) => paidOrderStatuses.includes(order.status)).reduce((total, order) => total + order.amount_mxn_cents, 0);

  return <div className="supervisor-orders">
    <div className="admin-toolbar">
<label className="admin-search">
<Search aria-hidden="true" size={17} />
<input type="search" aria-label="Buscar pedidos" placeholder="Buscar por pedido, ID, WhatsApp u objeto" value={query} onChange={(event) => setQuery(event.target.value)} />
</label>
<span className="select-control">
<select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | "all")}>
<option value="all">Todos los estados</option>{(Object.keys(labels) as OrderStatus[]).map((status) => <option value={status} key={status}>{labels[status]}</option>)}</select>
<ChevronDown aria-hidden="true" size={17} />
</span>
<label className="admin-date-filter">Desde<input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
<label className="admin-date-filter">Hasta<input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
<button className="secondary-button" disabled={loading || Boolean(updatingId)} onClick={() => void load()}>
<RefreshCw aria-hidden="true" size={16} />{loading ? "Actualizando…" : "Actualizar"}</button>
</div>
    <section className="admin-sales-summary" aria-label="Resumen de ventas filtrado"><div><small>VENTAS CONFIRMADAS</small><strong>{formatMoney(soldMxnCents)}</strong><span>{visible.filter((order) => paidOrderStatuses.includes(order.status)).length} pedidos pagados{fromDate || toDate ? " en el periodo elegido" : " en total"}</span></div>{(fromDate || toDate) && <button type="button" onClick={() => { setFromDate(""); setToDate(""); }}>Limpiar fechas</button>}</section>
    {message && <p className="notice">{message}</p>}
    {visible.map((order) => {
      const progress = progressByStatus[order.status] ?? -1;
      const actions = nextStates[order.status] ?? [];
      return <article className="supervisor-order" key={order.id}>
        <header className="supervisor-order-heading"><div><span className={`order-status-pill status-${order.status}`}>{labels[order.status]}</span><h2>#{order.id.slice(0, 8).toUpperCase()}</h2><p>{new Date(order.created_at).toLocaleString("es-MX")}</p></div><div><strong>{formatMoney(order.amount_mxn_cents)}</strong><span>{order.order_items.length} {order.order_items.length === 1 ? "objeto" : "objetos"}</span></div></header>
        <ol className="admin-order-progress" aria-label="Progreso del pedido">{progressSteps.map((step, index) => { const Icon = step.icon; return <li key={step.label} className={index < progress ? "complete" : index === progress ? "active" : ""}><span><Icon aria-hidden="true" size={15} /></span><small>{step.label}</small></li>; })}</ol>
        <button type="button" className="admin-order-detail-trigger" onClick={() => setSelectedOrder(order)}>Ver operación completa <span aria-hidden="true">↗</span></button>
        {actions.length > 0 && <SystemActionBar className="admin-order-actions" variant="contained">{actions.map((status) => <button className={status === "paid" || status === "delivered" ? "primary" : status === "canceled" || status === "rejected" ? "danger" : ""} key={status} disabled={loading || updatingId === order.id} onClick={() => setPendingAction({ order, status })}>{updatingId === order.id ? "Actualizando…" : actionLabels[status] ?? labels[status]}</button>)}</SystemActionBar>}
      </article>;
    })}
    <CommerceSheet open={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} titleId="admin-order-modal-title" eyebrow="OPERACIÓN DEL PEDIDO" title={selectedOrder ? `Pedido #${selectedOrder.id.slice(0, 8).toUpperCase()}` : "Detalle del pedido"} description={selectedOrder ? `${labels[selectedOrder.status]} · ${formatMoney(selectedOrder.amount_mxn_cents)}` : undefined} className="admin-order-sheet">
      {selectedOrder && <div className="admin-order-modal-content">
        <div className="admin-order-detail-grid">
          <section><p className="eyebrow">ENTREGA</p><h3>{selectedOrder.epic_display_name}</h3><dl><div><dt>Plataforma</dt><dd>{selectedOrder.recipient_platform}</dd></div><div><dt>ID interno</dt><dd>{selectedOrder.epic_account_id}</dd></div><div><dt>WhatsApp</dt><dd>{selectedOrder.contact_whatsapp}</dd></div><div><dt>Correo</dt><dd>{selectedOrder.customer_email || "Sin correo"}</dd></div></dl></section>
          <section><p className="eyebrow">PRODUCTOS A ENTREGAR</p><div className="admin-order-items">{selectedOrder.order_items.map((item, index) => <button type="button" className="admin-order-item" key={`${item.item_main_id}-${index}`} onClick={() => { setSelectedOrder(null); setSelectedItem(item); }}><span className="admin-order-item-image">{item.item_image_url ? <Image src={item.item_image_url} alt="" fill sizes="48px" /> : <b aria-hidden="true">{item.item_name.slice(0, 1)}</b>}</span><span className="admin-order-item-copy"><strong>{item.item_name}</strong><small>{item.quantity}× · ◉ {item.vbucks_price.toLocaleString("es-MX")} paVos</small></span><span className="admin-order-item-price">{formatMoney(item.unit_amount_mxn_cents * item.quantity)}<small>Ver objeto</small></span></button>)}</div><div className={`admin-payment-proof ${selectedOrder.paymentTicketUrl ? "received" : ""}`}><FileCheck2 aria-hidden="true" size={18} /><span><strong>{selectedOrder.paymentTicketUrl ? "Comprobante recibido" : "Pago confirmado por operación"}</strong><small>{selectedOrder.paymentTicketUrl ? "Archivo enviado por el cliente" : "El administrador puede confirmar el pago sin archivo"}</small></span>{selectedOrder.paymentTicketUrl && <a href={selectedOrder.paymentTicketUrl} target="_blank" rel="noreferrer">Abrir ↗</a>}</div></section>
        </div>
        {selectedOrder.history.length > 0 && <div className="admin-order-history"><p className="eyebrow">HISTORIAL</p>{selectedOrder.history.slice(0, 12).map((event, index) => <div key={`${event.created_at}-${index}`}><p><span>{event.after_data?.status ? labels[event.after_data.status as OrderStatus] ?? event.after_data.status : event.action}</span><small>{new Date(event.created_at).toLocaleString("es-MX")}</small></p>{event.after_data?.notes && <small className="admin-order-history-note">{event.after_data.notes}</small>}</div>)}</div>}
        <DeliveryTicketActions order={selectedOrder} />
      </div>}
    </CommerceSheet>
    <CommerceSheet open={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} titleId="admin-product-title" eyebrow="PRODUCTO A ENTREGAR" title={selectedItem?.item_name ?? "Detalle del producto"} description="Verifica visualmente el objeto antes de preparar la entrega." className="admin-product-sheet">
      {selectedItem && <div className="admin-product-preview"><div className="admin-product-preview-image">{selectedItem.item_image_url ? <Image src={selectedItem.item_image_url} alt={selectedItem.item_name} fill sizes="(max-width: 600px) 90vw, 420px" /> : <span aria-hidden="true">{selectedItem.item_name.slice(0, 1)}</span>}</div><dl><div><dt>Cantidad</dt><dd>{selectedItem.quantity}</dd></div><div><dt>Precio unitario</dt><dd>{formatMoney(selectedItem.unit_amount_mxn_cents)}</dd></div><div><dt>Precio en Fortnite</dt><dd>◉ {selectedItem.vbucks_price.toLocaleString("es-MX")} paVos</dd></div><div><dt>ID del objeto</dt><dd>{selectedItem.item_main_id}</dd></div></dl><Link className="primary-button" href={`/objetos/${encodeURIComponent(selectedItem.item_main_id)}?from=${encodeURIComponent("/admin")}`} target="_blank">Abrir detalle del producto ↗</Link></div>}
    </CommerceSheet>
    <AdminActionModal open={Boolean(pendingAction)} onClose={() => setPendingAction(null)} title={pendingAction ? actionLabels[pendingAction.status] ?? labels[pendingAction.status] : "Confirmar operación"} description={pendingAction ? `Pedido #${pendingAction.order.id.slice(0, 8).toUpperCase()} · ${formatMoney(pendingAction.order.amount_mxn_cents)}` : ""} confirmLabel={pendingAction ? actionLabels[pendingAction.status] ?? labels[pendingAction.status] : "Confirmar"} tone={pendingAction?.status === "canceled" || pendingAction?.status === "rejected" ? "danger" : "primary"} notesLabel={pendingAction && ["information_required", "rejected", "canceled"].includes(pendingAction.status) ? "Motivo para el cliente" : undefined} notesPlaceholder="Explica brevemente el motivo de esta operación." notesRequired={Boolean(pendingAction && ["information_required", "rejected", "canceled"].includes(pendingAction.status))} busy={Boolean(updatingId)} onConfirm={(notes) => { if (!pendingAction) return; const next = pendingAction; setPendingAction(null); void update(next.order, next.status, notes || (next.status === "paid" ? "Pago confirmado manualmente por el administrador." : undefined)); }} />
  </div>;
}

const paidTicketStatuses: readonly OrderStatus[] = ["paid", "ready_to_send", "validating_delivery", "delivering", "reconciling", "delivered"];

function DeliveryTicketActions({ order }: { order: Order }) {
  const [creating, setCreating] = useState<"image" | "pdf" | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const ready = paidTicketStatuses.includes(order.status);

  async function downloadImage() {
    setCreating("image");
    setTicketError(null);
    try {
      const canvas = await createTicketCanvas(order);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("No fue posible crear la imagen.")), "image/png"));
      const filename = `ticket-pedido-${order.id.slice(0, 8).toUpperCase()}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Ticket pedido #${order.id.slice(0, 8).toUpperCase()}` });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          // Some mobile browsers report file sharing support but reject it
          // after generating the canvas. The link fallback still lets users
          // download it or open it and save it from the image viewer.
        }
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = objectUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setTicketError("No fue posible compartir o descargar la imagen. Intenta nuevamente.");
    } finally { setCreating(null); }
  }

  function savePdf() {
    setCreating("pdf");
    try {
      const printWindow = window.open("", "_blank", "width=760,height=900");
      if (!printWindow) return;
      printWindow.opener = null;
      printWindow.document.write(ticketPrintDocument(order));
      printWindow.document.close();
      printWindow.focus();
    } finally { window.setTimeout(() => setCreating(null), 300); }
  }

  return <section className="delivery-ticket-actions">
    <div><p className="eyebrow">TICKET PARA EL CLIENTE</p><h3>Comprobante de compra y entrega</h3><p>Incluye el pedido, total, receptor y todos los objetos que deben entregarse.</p></div>
    <div className="delivery-ticket-buttons"><button type="button" className="ticket-image" disabled={!ready || creating !== null} onClick={() => void downloadImage()}>{creating === "image" ? "Generando imagen…" : "Compartir o descargar imagen"}</button><button type="button" className="ticket-pdf" disabled={!ready || creating !== null} onClick={savePdf}>{creating === "pdf" ? "Abriendo PDF…" : "Guardar como PDF"}</button></div>
    {ticketError && <small className="notice error">{ticketError}</small>}
    {!ready && <small>El ticket queda disponible cuando el pago esté confirmado.</small>}
  </section>;
}

async function createTicketCanvas(order: Order) {
  const width = 1080;
  const height = 570 + order.order_items.length * 104;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No fue posible crear el ticket.");
  context.fillStyle = "#091020"; context.fillRect(0, 0, width, height);
  context.fillStyle = "#151f40"; context.fillRect(38, 38, width - 76, height - 76);
  context.strokeStyle = "#2c4678"; context.lineWidth = 2; context.strokeRect(38, 38, width - 76, height - 76);
  context.fillStyle = "#ffd51f"; context.font = "900 22px Arial"; context.fillText("SIGFRIEDLOOTBOX · COMPRA CONFIRMADA", 84, 100);
  context.fillStyle = "#f6f8ff"; context.font = "900 48px Arial"; context.fillText(`PEDIDO #${order.id.slice(0, 8).toUpperCase()}`, 84, 165);
  context.fillStyle = "#aebddd"; context.font = "24px Arial"; context.fillText(new Date(order.created_at).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }), 84, 210);
  context.fillStyle = "#55d9ff"; context.font = "900 20px Arial"; context.fillText("RECEPTOR", 84, 278);
  context.fillStyle = "#f6f8ff"; context.font = "900 32px Arial"; context.fillText(order.epic_display_name, 84, 320);
  context.fillStyle = "#ffd51f"; context.font = "900 43px Arial"; context.textAlign = "right"; context.fillText(formatMoney(order.amount_mxn_cents), width - 84, 320); context.textAlign = "left";
  context.strokeStyle = "#344365"; context.beginPath(); context.moveTo(84, 360); context.lineTo(width - 84, 360); context.stroke();
  context.fillStyle = "#55d9ff"; context.font = "900 20px Arial"; context.fillText("PRODUCTOS A ENTREGAR", 84, 405);
  const artwork = await Promise.all(order.order_items.map((item) => loadTicketArtwork(item.item_image_url)));
  order.order_items.forEach((item, index) => {
    const top = 430 + index * 96;
    context.fillStyle = "#0d1630"; context.fillRect(84, top, width - 168, 80);
    const image = artwork[index];
    if (image) context.drawImage(image, 94, top + 8, 64, 64);
    else { context.fillStyle = "#20345d"; context.fillRect(94, top + 8, 64, 64); context.fillStyle = "#55d9ff"; context.font = "900 26px Arial"; context.fillText(item.item_name.slice(0, 1).toUpperCase(), 117, top + 49); }
    context.fillStyle = "#eef2ff"; context.font = "900 23px Arial"; context.fillText(item.item_name, 178, top + 34);
    context.fillStyle = "#aebddd"; context.font = "19px Arial"; context.fillText(`${item.quantity}× · ◉ ${item.vbucks_price.toLocaleString("es-MX")} paVos`, 178, top + 60);
    context.fillStyle = "#ffd51f"; context.font = "900 23px Arial"; context.textAlign = "right"; context.fillText(formatMoney(item.unit_amount_mxn_cents * item.quantity), width - 104, top + 47); context.textAlign = "left";
  });
  context.fillStyle = "#9cffcf"; context.font = "900 20px Arial"; context.fillText("PAGO CONFIRMADO", 84, height - 84);
  context.fillStyle = "#9aa9c9"; context.font = "18px Arial"; context.textAlign = "right"; context.fillText("Guarda este ticket como comprobante de tu compra.", width - 84, height - 84); context.textAlign = "left";
  return canvas;
}

async function loadTicketArtwork(url: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const objectUrl = URL.createObjectURL(await response.blob());
    const image = document.createElement("img");
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("image_load_failed")); image.src = objectUrl; });
    URL.revokeObjectURL(objectUrl);
    return image;
  } catch { return null; }
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character); }

function ticketPrintDocument(order: Order) {
  const id = order.id.slice(0, 8).toUpperCase();
  const items = order.order_items.map((item) => `<li>${item.item_image_url ? `<img src="${escapeHtml(item.item_image_url)}" alt="">` : "<i>□</i>"}<span><b>${item.quantity}× ${escapeHtml(item.item_name)}</b><small>◉ ${item.vbucks_price.toLocaleString("es-MX")} paVos</small></span><strong>${formatMoney(item.unit_amount_mxn_cents * item.quantity)}</strong></li>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ticket ${id}</title><style>body{background:#fff;color:#101522;font-family:Arial,sans-serif;margin:0}.ticket{border:1px solid #d6dce8;margin:32px auto;max-width:620px;padding:32px}.eyebrow{color:#236fe3;font-size:11px;font-weight:800;letter-spacing:1.4px}.header{border-bottom:1px solid #d6dce8;display:flex;justify-content:space-between;padding-bottom:20px}.header h1{font-size:25px;margin:8px 0}.amount{color:#d89500;font-size:30px;font-weight:900}.receiver{background:#f2f7ff;margin:22px 0;padding:16px}.receiver b{display:block;font-size:18px;margin-top:5px}ul{border-bottom:1px solid #d6dce8;border-top:1px solid #d6dce8;list-style:none;margin:18px 0;padding:10px 0}li{align-items:center;display:flex;gap:12px;padding:10px 0}li img,li i{background:#eef3fc;border-radius:7px;display:block;font-style:normal;height:52px;object-fit:contain;width:52px}li span{display:grid;flex:1;gap:4px}li small{color:#52627f;font-size:12px}li strong{white-space:nowrap}footer{color:#52627f;font-size:12px;margin-top:22px}@media print{.ticket{border:0;margin:0;max-width:none}}</style></head><body><main class="ticket"><p class="eyebrow">SIGFRIEDLOOTBOX · COMPRA CONFIRMADA</p><div class="header"><div><h1>Pedido #${id}</h1><small>${new Date(order.created_at).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}</small></div><strong class="amount">${formatMoney(order.amount_mxn_cents)}</strong></div><section class="receiver"><span>RECEPTOR DE LA ENTREGA</span><b>${escapeHtml(order.epic_display_name)}</b></section><h2>Productos a entregar</h2><ul>${items}</ul><footer>Pago confirmado. Guarda este ticket como comprobante de tu compra.</footer><script>window.addEventListener('load',function(){setTimeout(function(){window.print()},250)})<\/script></main></body></html>`;
}
