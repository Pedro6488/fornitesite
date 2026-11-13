"use client";

import { useState, type ReactNode } from "react";
import { AdminActionModal } from "@/shared/components/admin-action-modal";
import type { OrderStatus } from "@/features/orders/domain/order";
import { formatOrderMoney, shortOrderId, type OrderMoney } from "../application/format";
import type { OrderAction } from "../application/order-queues";
import { useAdminCounts } from "./admin-shell";
import { DeliveryReportList, SendGiftDialog, type DeliveryReport } from "./send-gift-dialog";
import { useAdminRequest } from "./use-admin-request";

export type ActionableOrder = OrderMoney & { id: string; status: OrderStatus; epic_display_name: string };

type Notice = { text: string; error: boolean; detail?: ReactNode };

/**
 * Confirmación y ejecución de una acción sobre un pedido.
 * La usan la lista y la página del pedido para que el mismo botón haga lo mismo en ambas.
 */
export function useOrderActions({ reload }: { reload: () => void | Promise<void> }) {
  const request = useAdminRequest();
  const { refreshCounts } = useAdminCounts();
  const [pending, setPending] = useState<{ order: ActionableOrder; action: OrderAction } | null>(null);
  const [sending, setSending] = useState<{ order: ActionableOrder; confirmPayment: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function settle() {
    // También tras un error: una entrega pudo avanzar algunos estados antes de detenerse.
    refreshCounts();
    await reload();
    setBusyId(null);
  }

  function reportNotice(report: DeliveryReport): Notice {
    const ok = report.status === "delivered";
    return { error: !ok, text: report.message, detail: <DeliveryReportList report={report} /> };
  }

  async function run(order: ActionableOrder, action: OrderAction, notes: string) {
    setBusyId(order.id);
    setNotice(null);
    try {
      if (action.kind === "deliver") {
        await request(`/api/admin/orders/${order.id}/delivered`, { method: "POST" });
        setNotice({ error: false, text: `Pedido ${shortOrderId(order.id)} entregado.` });
      } else if (action.kind === "reconcile") {
        const body = await request<{ report: DeliveryReport }>(`/api/admin/orders/${order.id}/reconcile`, { method: "POST" });
        setNotice(reportNotice(body.report));
      } else if (action.kind === "status") {
        await request(`/api/admin/orders/${order.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action.to, notes: notes || (action.to === "paid" ? "Pago confirmado manualmente por el administrador." : undefined) }),
        });
        setNotice({ error: false, text: action.to === "paid" ? `Pago del pedido ${shortOrderId(order.id)} confirmado. Ya está en «Por entregar».` : `Pedido ${shortOrderId(order.id)} actualizado.` });
      }
    } catch (cause) {
      setNotice({ error: true, text: cause instanceof Error ? cause.message : "No fue posible actualizar el pedido." });
    } finally {
      await settle();
    }
  }

  function ask(order: ActionableOrder, action: OrderAction) {
    if (action.kind === "send") { setNotice(null); setSending({ order, confirmPayment: action.confirmPayment }); return; }
    setPending({ order, action });
  }

  const action = pending?.action;
  const order = pending?.order;
  const copy = !action || !order ? null : action.kind === "deliver" ? {
    title: "Marcar como entregado",
    description: `Confirma que ya enviaste en Fortnite todos los objetos del pedido ${shortOrderId(order.id)} a ${order.epic_display_name}. El cliente verá su pedido como entregado y esto no se puede deshacer.`,
    confirmLabel: "Sí, ya lo entregué",
  } : action.kind === "reconcile" ? {
    title: "Conciliar envíos",
    description: `Busca en el historial de FN Shop los envíos sin confirmar del pedido ${shortOrderId(order.id)}. Usa 1 request por objeto dudoso y no envía nada.`,
    confirmLabel: "Buscar en el historial",
  } : action.kind === "status" && action.to === "paid" ? {
    title: "Confirmar pago",
    description: `Confirma que el depósito de ${formatOrderMoney(order)} del pedido ${shortOrderId(order.id)} ya aparece en la cuenta del banco. El pedido pasará a «Por entregar».`,
    confirmLabel: "Sí, el pago llegó",
  } : {
    title: action.label,
    description: `Pedido ${shortOrderId(order.id)} · ${formatOrderMoney(order)} · ${order.epic_display_name}`,
    confirmLabel: action.label,
  };
  const requiresNote = action?.kind === "status" && action.requiresNote;

  const modal = <>
    <AdminActionModal
      open={Boolean(pending)} onClose={() => setPending(null)}
      title={copy?.title ?? "Confirmar operación"} description={copy?.description ?? ""} confirmLabel={copy?.confirmLabel ?? "Confirmar"}
      tone={action?.tone === "danger" ? "danger" : "primary"}
      notesLabel={requiresNote ? "Motivo para el cliente" : undefined} notesPlaceholder="Explica brevemente el motivo; el cliente lo verá en su pedido." notesRequired={Boolean(requiresNote)}
      busy={Boolean(busyId)}
      onConfirm={(notes) => { if (!pending) return; const next = pending; setPending(null); void run(next.order, next.action, notes); }}
    />
    <SendGiftDialog
      order={sending?.order ?? null}
      confirmPayment={sending?.confirmPayment ?? false}
      onClose={() => setSending(null)}
      onFinished={(report, error) => {
        const target = sending?.order;
        setSending(null);
        if (target) setBusyId(target.id);
        setNotice(report ? reportNotice(report) : { error: true, text: error ?? "No fue posible enviar el regalo." });
        void settle();
      }}
    />
  </>;

  return { ask, busyId, notice, modal };
}

/** Aviso del resultado de la última acción, con el detalle por objeto cuando hubo envío. */
export function OrderActionNotice({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return <div className={`ac-notice${notice.error ? " is-error" : " is-success"}`} role="status">
    <p style={{ margin: 0 }}>{notice.text}</p>
    {notice.detail && <div style={{ marginTop: ".6rem" }}>{notice.detail}</div>}
  </div>;
}
