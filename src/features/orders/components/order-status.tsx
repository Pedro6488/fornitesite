"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { Order, OrderStatus as OrderState } from "../domain/order";
import { formatMxn, formatUsdCents, PAYPAL_FEE_USD_CENTS } from "@/features/pricing/domain/price-calculator";
import { PurchaseConfetti } from "@/shared/components/purchase-confetti";
import { SystemActionBar } from "@/shared/components/system-action-bar";
import { BackButton } from "@/shared/components/back-button";

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
  canceled: "Pedido cancelado",
};

export function OrderStatus({
  initialOrder,
  bank,
  whatsappNumber,
  appUrl,
}: {
  initialOrder: Order;
  bank: {
    name: string;
    beneficiary: string;
    clabe: string;
    concept: string;
    paypal: string;
  };
  whatsappNumber: string | null;
  appUrl: string;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deliveryFeedbackMessage, setDeliveryFeedbackMessage] = useState<string | null>(null);
  const [submittingDeliveryFeedback, setSubmittingDeliveryFeedback] = useState(false);
  const [deliveryFeedbackSubmitted, setDeliveryFeedbackSubmitted] = useState(Boolean(initialOrder.deliveryFeedbackSubmittedAt));
  const isUsdOrder = order.currency === "USD";
  const totalLabel = isUsdOrder
    ? `${formatUsdCents(order.amountUsdCents ?? 0)} USD`
    : formatMxn(order.amountMxnCents / 100);
  const canUpload =
    order.status === "awaiting_transfer" ||
    order.status === "information_required";
  const whatsappHref = useMemo(() => {
    if (!whatsappNumber) return null;
    const tracking = `${appUrl}/pedidos/${order.id}?access=${order.publicToken}`;
    const copy = `Hola, necesito ayuda con el pedido ${order.id.slice(0, 8).toUpperCase()}. Seguimiento: ${tracking}`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(copy)}`;
  }, [appUrl, order.id, order.publicToken, whatsappNumber]);
  async function refresh(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(
        `/api/orders/${order.id}?access=${order.publicToken}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "No fue posible actualizar el pedido.");
      setOrder(body.order);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el pedido.",
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function uploadTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    form.set("access", order.publicToken);
    try {
      const response = await fetch(`/api/orders/${order.id}/payment-ticket`, {
        method: "POST",
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "No fue posible subir el comprobante.");
      setMessage("Comprobante recibido, se verificará.");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible subir el comprobante.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitDeliveryFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingDeliveryFeedback(true);
    setDeliveryFeedbackMessage(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("access", order.publicToken);
    try {
      const response = await fetch(`/api/orders/${order.id}/delivery-feedback`, {
        method: "POST",
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "No fue posible guardar tu confirmación.");
      setDeliveryFeedbackMessage("Gracias, tu confirmación fue guardada.");
      setDeliveryFeedbackSubmitted(true);
      formElement.reset();
    } catch (error) {
      setDeliveryFeedbackMessage(error instanceof Error ? error.message : "No fue posible guardar tu confirmación.");
    } finally {
      setSubmittingDeliveryFeedback(false);
    }
  }

  async function trackWhatsapp() {
    await fetch(`/api/orders/${order.id}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access: order.publicToken, channel: "whatsapp" }),
      keepalive: true,
    }).catch(() => undefined);
  }

  return (
    <div className="order-status-card">
      <PurchaseConfetti />
      <div className="order-summary">
        <div>
          <p className="eyebrow">PEDIDO {order.id.slice(0, 8).toUpperCase()}</p>
          <h2>Resumen de compra</h2>
          <span>Para {order.epicDisplayName}</span>
        </div>
        <strong>{totalLabel}</strong>
      </div>
      <div className="order-items-summary">
        {(order.items ?? []).map((item, index) => (
          <p key={`${item.itemName}-${index}`}>
            <span>{item.itemName}</span>
            <strong>{isUsdOrder ? `${formatUsdCents(item.unitAmountUsdCents ?? 0)} USD` : formatMxn(item.unitAmountMxnCents / 100)}</strong>
          </p>
        ))}
        {isUsdOrder && <p><span>Comisión PayPal</span><strong>{formatUsdCents(order.paypalFeeUsdCents ?? PAYPAL_FEE_USD_CENTS)} USD</strong></p>}
      </div>
      <div className="recipient-id-notice">
        <span>
          {order.status === "manual_review"
            ? "ID DE ENTREGA EN REVISIÓN"
            : "ID DE ENTREGA VALIDADO"}
        </span>
        <strong>{order.epicDisplayName}</strong>
        <p>
          {order.status === "manual_review"
            ? "Revisaremos este ID antes de solicitarte el pago. Te avisaremos cuando quede aprobado."
            : "Este es el ID que recibirá el pedido y no puede cambiarse después de confirmar."}
        </p>
      </div>
      <div className={`canonical-order-status status-${order.status}`}>
        <span>ESTADO DEL PEDIDO</span>
        <strong>{statusCopy[order.status]}</strong>
      </div>
      {order.status === "canceled" && (
        <div className="order-cancellation-note" role="status">
          <span>MOTIVO DE LA CANCELACIÓN</span>
          <strong>
            {order.statusNote ||
              "El administrador canceló el pedido. Contáctanos por WhatsApp si necesitas ayuda."}
          </strong>
        </div>
      )}
      {canUpload && (
        <>
          <div className="bank-details">
            {!isUsdOrder && <>
              <p>
                <span>Banco</span>
                <strong>{bank.name}</strong>
              </p>
              <p>
                <span>Beneficiario</span>
                <strong>{bank.beneficiary}</strong>
              </p>
              <p>
                <span>CLABE</span>
                <strong>{bank.clabe}</strong>
              </p>
              <p>
                <span>Concepto</span>
                <strong>{bank.concept}</strong>
              </p>
            </>}
            <p>
              <span>PayPal</span>
              <strong>{bank.paypal}</strong>
            </p>
            <small>
              Usa el folio PEDIDO-{order.id.slice(0, 8).toUpperCase()} en la
              nota o comprobante.
            </small>
          </div>
          <form
            id="receipt-upload-form"
            className="receipt-form"
            onSubmit={uploadTicket}
          >
            <label>
              Comprobante de pago
              <input
                name="ticket"
                type="file"
                required
                accept="image/jpeg,image/png,application/pdf"
              />
            </label>
          </form>
        </>
      )}
      {order.status === "delivered" && deliveryFeedbackSubmitted && (
        <div className="delivery-feedback-submitted" role="status">
          <span>REFERENCIA ENVIADA</span>
          <strong>Gracias por confirmar tu entrega.</strong>
          <p>Tu comentario e imagen ya fueron enviados al equipo.</p>
        </div>
      )}
      {order.status === "delivered" && !deliveryFeedbackSubmitted && (
        <form className="delivery-feedback-form" onSubmit={submitDeliveryFeedback}>
          <div>
            <span className="eyebrow">CONFIRMA TU ENTREGA</span>
            <h3>¿Recibiste tus productos?</h3>
            <p>Si quieres, comparte hasta tres imágenes o un comentario. Ambos son opcionales.</p>
          </div>
          <label>
            Imágenes de la entrega <span>(máximo 3)</span>
            <span className="delivery-image-inputs">
              <input name="images" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Imagen de entrega 1" />
              <input name="images" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Imagen de entrega 2" />
              <input name="images" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Imagen de entrega 3" />
            </span>
          </label>
          <label>
            Comentario
            <textarea name="comment" rows={4} maxLength={1000} placeholder="Cuéntanos cómo fue tu entrega (opcional)" />
          </label>
          <button className="secondary-button" disabled={submittingDeliveryFeedback}>
            {submittingDeliveryFeedback ? "Guardando…" : "Enviar confirmación"}
          </button>
          {deliveryFeedbackMessage && (
            <p className={`notice ${deliveryFeedbackMessage.startsWith("Gracias") ? "success" : "error"}`}>
              {deliveryFeedbackMessage}
            </p>
          )}
        </form>
      )}
      <SystemActionBar className="post-sale-actions order-tracking-actions">
          {canUpload && (
            <button
              form="receipt-upload-form"
              className="primary-button"
              disabled={loading}
            >
              {loading
                ? "Subiendo…"
                : order.status === "information_required"
                  ? "Enviar nuevo comprobante"
                  : "Subir comprobante"}
            </button>
          )}
          {whatsappHref && order.status !== "delivered" && (
            <a
              className="whatsapp-button"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => void trackWhatsapp()}
            >
              Continuar por WhatsApp <span>↗</span>
            </a>
          )}
          {!canUpload && order.status !== "delivered" && (
            <button
              className="secondary-button"
              disabled={loading}
              onClick={() => void refresh(true)}
            >
              {loading ? "Actualizando…" : "Actualizar estado"}
            </button>
          )}
          {order.status === "delivered" && <>
            <a className="primary-button order-store-link" href="/#catalogo">Regresar a la tienda</a>
            <BackButton label="Atrás" fallbackHref="/#catalogo" />
          </>}
        </SystemActionBar>
      {message && (
        <p
          className={`notice ${message.startsWith("Comprobante") ? "success" : "error"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
