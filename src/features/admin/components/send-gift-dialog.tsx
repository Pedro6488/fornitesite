"use client";

import { useEffect, useState } from "react";
import { CommerceSheet } from "@/features/commerce/components/commerce-sheet";
import { formatDateTime, formatOrderMoney, shortOrderId, type OrderMoney } from "../application/format";
import { useAdminRequest } from "./use-admin-request";

type PreflightItem = { itemId: string; name: string; vbucksPrice: number; offerRefreshed: boolean } & (
  | { eligible: true; senderId: string | null; finalPrice: number | null }
  | { eligible: false; code: string; message: string; giftableAt: string | null }
);
type ItemReport = { itemId: string; name: string; result: "sent" | "unknown" | "failed" | "skipped" | "not_attempted"; message: string | null };
export type DeliveryReport = { status: string; items: ItemReport[]; message: string };

export type SendTarget = OrderMoney & { id: string; epic_display_name: string };

const RESULT_LABELS: Record<ItemReport["result"], { text: string; tone: string }> = {
  sent: { text: "Enviado", tone: "is-ok" },
  unknown: { text: "Sin confirmar", tone: "is-wait" },
  skipped: { text: "En curso", tone: "is-wait" },
  failed: { text: "No enviado", tone: "is-bad" },
  not_attempted: { text: "Pendiente", tone: "is-idle" },
};

/**
 * «Confirmar pago y enviar regalo» en dos pasos:
 *  1. Pre-vuelo (gift_check por objeto): destinatario, objeto, paVos, cuenta que lo enviará y si se puede.
 *  2. «Enviar ahora — no se puede deshacer».
 * Lo que gasta requests lo dice antes de pulsar.
 */
export function SendGiftDialog({ order, confirmPayment, onClose, onFinished }: {
  order: SendTarget | null;
  confirmPayment: boolean;
  onClose: () => void;
  onFinished: (report: DeliveryReport | null, error: string | null) => void;
}) {
  const request = useAdminRequest();
  const [phase, setPhase] = useState<"checking" | "ready" | "sending">("checking");
  const [items, setItems] = useState<PreflightItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const orderId = order?.id ?? null;

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    const frame = window.requestAnimationFrame(() => {
      setPhase("checking"); setItems([]); setError(null);
      request<{ items: PreflightItem[] }>(`/api/admin/orders/${orderId}/preflight`, { method: "POST" })
        .then((body) => { if (active) { setItems(body.items); setPhase("ready"); } })
        .catch((cause: unknown) => { if (active) { setError(cause instanceof Error ? cause.message : "No fue posible revisar el pedido."); setPhase("ready"); } });
    });
    return () => { active = false; window.cancelAnimationFrame(frame); };
  }, [orderId, request]);

  async function send() {
    if (!order) return;
    setPhase("sending");
    try {
      const body = await request<{ report: DeliveryReport }>(`/api/admin/orders/${order.id}/deliver`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmPayment }),
      });
      onFinished(body.report, null);
    } catch (cause) {
      onFinished(null, cause instanceof Error ? cause.message : "No fue posible enviar el regalo.");
    }
  }

  const blocked = items.filter((item) => !item.eligible);
  const canSend = phase === "ready" && !error && items.length > 0 && blocked.length === 0;
  const requests = items.length;

  return <CommerceSheet open={Boolean(order)} onClose={() => { if (phase !== "sending") onClose(); }} titleId="ac-send-title" eyebrow="ENTREGA CON FN SHOP"
    title={confirmPayment ? "Confirmar pago y enviar regalo" : "Enviar regalo"}
    description={order ? `Pedido ${shortOrderId(order.id)} · ${formatOrderMoney(order)} · para ${order.epic_display_name}` : ""}
    className="admin-action-sheet">
    <div className="admin-action-form" style={{ display: "grid", gap: ".85rem" }}>
      {confirmPayment && <p className="ac-send-warning">Al enviar también se confirma el pago: revisa antes que el depósito de {order ? formatOrderMoney(order) : ""} ya esté en el banco.</p>}
      {phase === "checking" && <p className="ac-notice" role="status">Revisando con FN Shop que cada objeto se pueda enviar…</p>}
      {error && <p className="ac-notice is-error" role="alert">{error}</p>}
      {items.length > 0 && <ul className="ac-send-list" aria-label="Objetos a enviar">
        {items.map((item) => <li key={item.itemId}>
          <strong>{item.name}</strong>
          <span className={`ac-send-state ${item.eligible ? "is-ok" : "is-bad"}`}>{item.eligible ? "Se puede enviar" : "No se puede"}</span>
          <small>
            {item.vbucksPrice.toLocaleString("es-MX")} paVos
            {item.eligible
              ? `${item.finalPrice !== null && item.finalPrice !== item.vbucksPrice ? ` · precio en Fortnite: ${item.finalPrice.toLocaleString("es-MX")}` : ""}${item.senderId ? ` · lo envía la cuenta ${item.senderId.slice(0, 6)}…` : ""}`
              : ` · ${item.message}${item.giftableAt ? ` Disponible el ${formatDateTime(item.giftableAt)}.` : ""}`}
            {item.offerRefreshed ? " · se actualizó el offerId vigente" : ""}
          </small>
        </li>)}
      </ul>}
      {phase === "ready" && blocked.length > 0 && <p className="ac-send-warning">No se envía nada mientras haya objetos que no se pueden enviar. Resuelve el motivo o entrégalo a mano.</p>}
      {canSend && <p className="ac-send-warning">Se usarán {requests} {requests === 1 ? "request" : "requests"} de FN Shop y se gastarán paVos de las cuentas remitentes. Un regalo enviado no se puede deshacer.</p>}
      <div className="ac-send-actions">
        <button type="button" className="admin-action-cancel" disabled={phase === "sending"} onClick={onClose}>Volver</button>
        <button type="button" className="admin-action-confirm danger" disabled={!canSend} onClick={() => void send()}>
          {phase === "sending" ? "Enviando…" : "Enviar ahora — no se puede deshacer"}
        </button>
      </div>
    </div>
  </CommerceSheet>;
}

/** Resumen del envío, objeto por objeto, para mostrar debajo del aviso. */
export function DeliveryReportList({ report }: { report: DeliveryReport }) {
  return <ul className="ac-send-list" aria-label="Resultado del envío">
    {report.items.map((item) => <li key={item.itemId}>
      <strong>{item.name}</strong>
      <span className={`ac-send-state ${RESULT_LABELS[item.result].tone}`}>{RESULT_LABELS[item.result].text}</span>
      {item.message && <small>{item.message}</small>}
    </li>)}
  </ul>;
}
