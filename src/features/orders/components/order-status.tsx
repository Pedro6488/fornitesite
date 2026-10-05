"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { Order, OrderStatus as OrderState } from "../domain/order";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { PurchaseConfetti } from "@/shared/components/purchase-confetti";
import { SystemActionBar } from "@/shared/components/system-action-bar";

const statusCopy: Record<OrderState, string> = {
  draft: "Preparando pedido",
  payment_pending: "Pago pendiente",
  awaiting_transfer: "Pendiente de transferencia",
  receipt_submitted: "Comprobante recibido",
  transfer_review: "Pago en revisión",
  information_required: "Necesitamos otro comprobante",
  paid: "Pago aprobado",
  ready_to_send: "Listo para procesar",
  validating_delivery: "Validando entrega",
  delivering: "Enviando objetos",
  reconciling: "Confirmando entrega",
  delivered: "Pedido entregado",
  manual_review: "Revisión manual",
  refund_pending: "Reembolso pendiente",
  refunded: "Reembolsado",
  rejected: "Pago declinado",
  expired: "Pedido vencido",
  canceled: "Pedido cancelado"
};

export function OrderStatus({ initialOrder, bank, whatsappNumber, appUrl }: { initialOrder: Order; bank: { name: string; beneficiary: string; clabe: string }; whatsappNumber: string | null; appUrl: string }) {
  const [order, setOrder] = useState(initialOrder);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canUpload = order.status === "awaiting_transfer" || order.status === "information_required";
  const whatsappHref = useMemo(() => {
    if (!whatsappNumber) return null;
    const tracking = `${appUrl}/pedidos/${order.id}?access=${order.publicToken}`;
    const copy = `Hola, necesito ayuda con el pedido ${order.id.slice(0, 8).toUpperCase()}. Seguimiento: ${tracking}`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(copy)}`;
  }, [appUrl, order.id, order.publicToken, whatsappNumber]);

  async function refresh() {
    const response = await fetch(`/api/orders/${order.id}?access=${order.publicToken}`, { cache: "no-store" });
    if (response.ok) setOrder((await response.json()).order);
  }

  async function uploadTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage(null);
    const form = new FormData(event.currentTarget); form.set("access", order.publicToken);
    const response = await fetch(`/api/orders/${order.id}/payment-ticket`, { method: "POST", body: form });
    const body = await response.json(); setLoading(false);
    setMessage(response.ok ? "Comprobante recibido. Un administrador lo revisará." : body.error);
    if (response.ok) await refresh();
  }

  async function trackWhatsapp() {
    await fetch(`/api/orders/${order.id}/contact`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access: order.publicToken, channel: "whatsapp" }), keepalive: true
    }).catch(() => undefined);
  }

  return <div className="order-status-card">
    <PurchaseConfetti />
    <div className="order-summary"><div><p className="eyebrow">PEDIDO {order.id.slice(0, 8).toUpperCase()}</p><h2>Resumen de compra</h2><span>Para {order.epicDisplayName}</span></div><strong>{formatMxn(order.amountMxnCents / 100)}</strong></div>
    <div className="order-items-summary">{(order.items ?? []).map((item, index) => <p key={`${item.itemName}-${index}`}><span>{item.itemName}</span><strong>{formatMxn(item.unitAmountMxnCents / 100)}</strong></p>)}</div>
    <div className="recipient-id-notice"><span>{order.status === "manual_review" ? "ID DE ENTREGA EN REVISIÓN" : "ID DE ENTREGA VALIDADO"}</span><strong>{order.epicDisplayName}</strong><p>{order.status === "manual_review" ? "Revisaremos este ID antes de solicitarte el pago. Te avisaremos cuando quede aprobado." : "Este es el ID que recibirá el pedido y no puede cambiarse después de confirmar."}</p></div>
    <div className={`canonical-order-status status-${order.status}`}><span>ESTADO DEL PEDIDO</span><strong>{statusCopy[order.status]}</strong></div>
    {canUpload && <>
      <div className="bank-details"><p><span>Banco</span><strong>{bank.name}</strong></p><p><span>Beneficiario</span><strong>{bank.beneficiary}</strong></p><p><span>CLABE</span><strong>{bank.clabe}</strong></p><p><span>Concepto</span><strong>PEDIDO-{order.id.slice(0, 8).toUpperCase()}</strong></p></div>
      <form id="receipt-upload-form" className="receipt-form" onSubmit={uploadTicket}><label>Comprobante de pago<input name="ticket" type="file" required accept="image/jpeg,image/png,application/pdf" /></label></form>
    </>}
    {(canUpload || whatsappHref || order.status !== "delivered") && <SystemActionBar className="post-sale-actions order-tracking-actions">{canUpload && <button form="receipt-upload-form" className="primary-button" disabled={loading}>{loading ? "Subiendo…" : order.status === "information_required" ? "Enviar nuevo comprobante" : "Subir comprobante"}</button>}{whatsappHref && <a className="whatsapp-button" href={whatsappHref} target="_blank" rel="noreferrer" onClick={() => void trackWhatsapp()}>Continuar por WhatsApp <span>↗</span></a>}{!canUpload && order.status !== "delivered" && <button className="secondary-button" onClick={() => void refresh()}>Actualizar estado</button>}</SystemActionBar>}
    {message && <p className={`notice ${message.startsWith("Comprobante") ? "success" : "error"}`}>{message}</p>}
  </div>;
}
