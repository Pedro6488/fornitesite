"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, FileCheck2, FileX2 } from "lucide-react";
import { DeliveryTicketActions } from "@/features/orders/components/delivery-ticket-actions";
import type { OrderStatus } from "@/features/orders/domain/order";
import { formatDateTime, formatMoney, shortOrderId } from "../application/format";
import { ORDER_QUEUES, ORDER_STATUS_LABELS, primaryActionOf, queueOf, secondaryActionsOf } from "../application/order-queues";
import { AdminPageHeader } from "./admin-shell";
import { useOrderActions } from "./order-actions";
import { useAdminData } from "./use-admin-request";

type OrderItem = { item_main_id: string; item_name: string; item_image_url: string | null; vbucks_price: number; quantity: number; unit_amount_mxn_cents: number };
type OrderDetailData = {
  id: string; created_at: string; paid_at: string | null; delivered_at: string | null; customer_email: string | null;
  epic_display_name: string; epic_account_id: string; recipient_platform: string; contact_whatsapp: string | null;
  amount_mxn_cents: number; status: OrderStatus; order_items: OrderItem[];
  receipt: { url: string | null; mimeType: string | null; createdAt: string } | null;
  deliveryFeedback: { comment: string | null; createdAt: string; imageUrl: string | null } | null;
  history: { action: string; created_at: string; after_data: { status?: string; notes?: string } | null }[];
};

const PLATFORM_LABELS: Record<string, string> = { epic: "Epic Games", xbl: "Xbox", psn: "PlayStation", nintendo: "Nintendo" };

const STEPS: readonly { label: string; reached: (order: OrderDetailData) => boolean }[] = [
  { label: "Pedido creado", reached: () => true },
  { label: "Comprobante", reached: (order) => Boolean(order.receipt || order.paid_at) },
  { label: "Pago confirmado", reached: (order) => Boolean(order.paid_at) },
  { label: "Entregado", reached: (order) => order.status === "delivered" },
];

export function OrderDetail({ orderId }: { orderId: string }) {
  const { data, error, loading, reload } = useAdminData<{ order: OrderDetailData }>(`/api/admin/orders/${orderId}`);
  const actions = useOrderActions({ reload });
  const order = data?.order;

  if (!order) return <>
    <AdminPageHeader title="Pedido" back={{ href: "/admin/pedidos", label: "Pedidos" }} />
    {error ? <p className="ac-notice is-error" role="alert">{error}</p> : <p className="ac-notice">Cargando pedido…</p>}
  </>;

  const queue = ORDER_QUEUES.find((entry) => entry.id === queueOf(order.status))!;
  const primary = primaryActionOf(order.status);
  const secondary = secondaryActionsOf(order.status);
  const busy = actions.busyId === order.id || loading;
  const whatsapp = order.contact_whatsapp?.replace(/\D/g, "");
  const receiptIsImage = Boolean(order.receipt?.url && order.receipt.mimeType?.startsWith("image/"));

  return <>
    <AdminPageHeader title={`Pedido ${shortOrderId(order.id)}`} lead={`Creado el ${formatDateTime(order.created_at)}`} back={{ href: `/admin/pedidos?cola=${queue.id}`, label: `Pedidos · ${queue.label}` }} />

    {actions.notice && <p className={`ac-notice${actions.notice.error ? " is-error" : " is-success"}`} role="status">{actions.notice.text}</p>}
    {error && <p className="ac-notice is-error" role="alert">{error}</p>}

    <section className="ac-card ac-next" aria-labelledby="ac-next-title">
      <div>
        <span className={`ac-pill status-${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span>
        <h2 id="ac-next-title">{primary ? "Qué sigue" : "Pedido cerrado"}</h2>
        <p>{primary ? queue.hint : `Este pedido terminó como «${ORDER_STATUS_LABELS[order.status]}». No hay nada más que hacer.`}</p>
        <ol className="ac-steps" aria-label="Avance del pedido">
          {STEPS.map((step) => <li key={step.label} className={step.reached(order) ? "is-done" : ""}>{step.label}</li>)}
        </ol>
      </div>
      <div className="ac-next-actions">
        <strong>{formatMoney(order.amount_mxn_cents)}</strong>
        {primary && <button type="button" className="ac-primary" disabled={busy} onClick={() => actions.ask(order, primary)}>{actions.busyId === order.id ? "Guardando…" : primary.label}</button>}
        {secondary.length > 0 && <details className="ac-other">
          <summary>Otras acciones</summary>
          <div>{secondary.map((action) => <button key={action.kind === "status" ? action.to : "deliver"} type="button" className={action.tone === "danger" ? "ac-danger" : "ac-secondary"} disabled={busy} onClick={() => actions.ask(order, action)}>{action.label}</button>)}</div>
        </details>}
      </div>
    </section>

    <div className="ac-grid-2 ac-detail">
      <section className="ac-card" aria-labelledby="ac-receipt-title">
        <header className="ac-card-head"><div><h2 id="ac-receipt-title">Comprobante de pago</h2><p>El depósito en el banco debe ser de {formatMoney(order.amount_mxn_cents)}.</p></div></header>
        {order.receipt ? <>
          <p className="ac-flag is-ok"><FileCheck2 aria-hidden="true" size={15} />Enviado por el cliente el {formatDateTime(order.receipt.createdAt)}</p>
          {order.receipt.url
            ? <a className="ac-receipt" href={order.receipt.url} target="_blank" rel="noreferrer">
              {receiptIsImage && <img src={order.receipt.url} alt={`Comprobante del pedido ${shortOrderId(order.id)}`} />}
              <span><ExternalLink aria-hidden="true" size={15} />{receiptIsImage ? "Abrir en tamaño completo" : "Abrir comprobante"}</span>
            </a>
            : <p className="ac-notice is-error">No fue posible abrir el archivo del comprobante. Actualiza la página.</p>}
        </> : <p className="ac-flag"><FileX2 aria-hidden="true" size={15} />{order.paid_at ? "El pago se confirmó sin archivo de comprobante." : "El cliente todavía no envía su comprobante."}</p>}
      </section>

      <section className="ac-card" aria-labelledby="ac-recipient-title">
        <header className="ac-card-head"><div><h2 id="ac-recipient-title">Quién recibe</h2><p>La cuenta de Fortnite a la que se envía el regalo.</p></div></header>
        <p className="ac-recipient">{order.epic_display_name}</p>
        <dl className="ac-figures">
          <div><dt>Plataforma</dt><dd>{PLATFORM_LABELS[order.recipient_platform] ?? order.recipient_platform}</dd></div>
          <div><dt>WhatsApp</dt><dd>{whatsapp ? <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">{order.contact_whatsapp}</a> : "Sin teléfono"}</dd></div>
          <div><dt>Correo</dt><dd>{order.customer_email || "Sin correo"}</dd></div>
          <div><dt>ID interno</dt><dd className="ac-mono">{order.epic_account_id}</dd></div>
        </dl>
      </section>
    </div>

    <section className="ac-card" aria-labelledby="ac-items-title">
      <header className="ac-card-head"><div><h2 id="ac-items-title">Objetos a entregar</h2><p>{order.order_items.length} {order.order_items.length === 1 ? "objeto" : "objetos"} en este pedido.</p></div></header>
      <ul className="ac-items">
        {order.order_items.map((item, index) => <li key={`${item.item_main_id}-${index}`}>
          <span className="ac-thumb is-large">{item.item_image_url ? <Image src={item.item_image_url} alt="" width={56} height={56} unoptimized /> : <b aria-hidden="true">{item.item_name.slice(0, 1)}</b>}</span>
          <div><strong>{item.quantity}× {item.item_name}</strong><small>{item.vbucks_price.toLocaleString("es-MX")} paVos</small></div>
          <span>{formatMoney(item.unit_amount_mxn_cents * item.quantity)}</span>
          <Link className="ac-link" href={`/objetos/${encodeURIComponent(item.item_main_id)}?from=${encodeURIComponent("/admin")}`} target="_blank">Ver en la tienda</Link>
        </li>)}
      </ul>
    </section>

    {order.deliveryFeedback && <section className="ac-card" aria-labelledby="ac-feedback-title">
      <header className="ac-card-head"><div><h2 id="ac-feedback-title">Recomendación del cliente</h2><p>Enviada el {formatDateTime(order.deliveryFeedback.createdAt)}.</p></div></header>
      {order.deliveryFeedback.comment && <blockquote className="ac-quote">{order.deliveryFeedback.comment}</blockquote>}
      {order.deliveryFeedback.imageUrl && <a className="ac-receipt" href={order.deliveryFeedback.imageUrl} target="_blank" rel="noreferrer"><img src={order.deliveryFeedback.imageUrl} alt={`Evidencia de entrega de ${order.epic_display_name}`} /><span><ExternalLink aria-hidden="true" size={15} />Abrir imagen</span></a>}
    </section>}

    <section className="ac-card" aria-labelledby="ac-history-title">
      <header className="ac-card-head"><div><h2 id="ac-history-title">Historial</h2><p>Cada cambio de estado, del más reciente al más antiguo.</p></div></header>
      {order.history.length === 0 ? <p className="ac-empty">Este pedido todavía no tiene cambios registrados.</p> : <ol className="ac-timeline">
        {order.history.map((event, index) => <li key={`${event.created_at}-${index}`}>
          <p><strong>{event.after_data?.status ? ORDER_STATUS_LABELS[event.after_data.status as OrderStatus] ?? event.after_data.status : event.action}</strong><time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time></p>
          {event.after_data?.notes && <small>{event.after_data.notes}</small>}
        </li>)}
      </ol>}
    </section>

    <div className="ac-legacy"><DeliveryTicketActions order={order} /></div>
    {actions.modal}
  </>;
}
