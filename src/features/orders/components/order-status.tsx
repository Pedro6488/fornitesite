"use client";

import { useState, type FormEvent } from "react";
import type { Order } from "../domain/order";
import { formatMxn } from "@/features/pricing/domain/price-calculator";

const statusCopy: Record<string, string> = {
  payment_pending: "Validando Mercado Pago", awaiting_transfer: "Esperando transferencia", receipt_submitted: "Comprobante recibido",
  transfer_review: "Validando transferencia (hasta 15 minutos)", information_required: "Necesitamos más información",
  paid: "Pago confirmado", ready_to_send: "Listo para enviar", validating_delivery: "Validando agente",
  delivering: "Enviando regalo", delivered: "Regalo entregado", manual_review: "Revisión manual",
  refund_pending: "Procesando devolución", refunded: "Pago devuelto", rejected: "Pago rechazado", expired: "Orden vencida"
};

export function OrderStatus({ initialOrder, bank }: { initialOrder: Order; bank: { name: string; beneficiary: string; clabe: string } }) {
  const [order, setOrder] = useState(initialOrder); const [message, setMessage] = useState<string | null>(null); const [loading, setLoading] = useState(false);

  async function refresh() {
    const response = await fetch(`/api/orders/${order.id}?access=${order.publicToken}`, { cache: "no-store" });
    if (response.ok) setOrder((await response.json()).order);
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage(null); const form = new FormData(event.currentTarget); form.set("access", order.publicToken);
    const response = await fetch(`/api/orders/${order.id}/receipt`, { method: "POST", body: form }); const body = await response.json(); setLoading(false);
    setMessage(response.ok ? "Comprobante recibido. Lo validaremos en hasta 15 minutos dentro del horario de atención." : body.error); if (response.ok) await refresh();
  }
  async function sendGift() {
    setLoading(true); setMessage(null); const response = await fetch(`/api/orders/${order.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access: order.publicToken }) }); const body = await response.json(); setLoading(false);
    setMessage(response.ok ? "El regalo fue enviado correctamente." : body.error); await refresh();
  }

  const transferOpen = ["awaiting_transfer", "information_required"].includes(order.status);
  const sendEnabled = order.status === "ready_to_send";
  return <div className="order-status-card">
    <div className="order-summary"><div><p className="eyebrow">PEDIDO {order.id.slice(0, 8).toUpperCase()}</p><h2>{order.itemName}</h2><span>Para {order.epicDisplayName}</span></div><strong>{formatMxn(order.amountMxnCents / 100)}</strong></div>
    <div className={`status-banner status-${order.status}`}><span>Estado</span><strong>{statusCopy[order.status] ?? order.status}</strong></div>
    {transferOpen && <><div className="bank-details"><p><span>Banco</span><strong>{bank.name}</strong></p><p><span>Beneficiario</span><strong>{bank.beneficiary}</strong></p><p><span>CLABE</span><strong>{bank.clabe}</strong></p><p><span>Concepto</span><strong>PEDIDO-{order.id.slice(0, 8).toUpperCase()}</strong></p></div><form className="receipt-form" onSubmit={upload}><label>Banco emisor<input name="senderBank" required maxLength={80} /></label><label>Nombre del titular<input name="senderName" required maxLength={120} /></label><label>Referencia<input name="reference" required maxLength={120} /></label><label>Comprobante<input name="receipt" type="file" required accept="image/jpeg,image/png,application/pdf" /></label><button className="secondary-button" disabled={loading}>Enviar comprobante</button></form></>}
    {sendEnabled && <div className="send-panel"><p>Pago confirmado. Revisa el receptor antes de continuar.</p><button className="primary-button" onClick={sendGift} disabled={loading}>{loading ? "Validando…" : "Enviar regalo"}</button></div>}
    {message && <p className="notice">{message}</p>}
    {!sendEnabled && !transferOpen && order.status !== "delivered" && <button className="secondary-button" onClick={refresh}>Actualizar estado</button>}
  </div>;
}
