"use client";

import { useState } from "react";
import { AdminActionModal } from "@/shared/components/admin-action-modal";
import type { OrderStatus } from "@/features/orders/domain/order";
import { formatOrderMoney, shortOrderId, type OrderMoney } from "../application/format";
import type { OrderAction } from "../application/order-queues";
import { useAdminCounts } from "./admin-shell";
import { useAdminRequest } from "./use-admin-request";

export type ActionableOrder = OrderMoney & { id: string; status: OrderStatus; epic_display_name: string };

/**
 * Confirmación y ejecución de una acción sobre un pedido.
 * La usan la lista y la página del pedido para que el mismo botón haga lo mismo en ambas.
 */
export function useOrderActions({ reload }: { reload: () => void | Promise<void> }) {
  const request = useAdminRequest();
  const { refreshCounts } = useAdminCounts();
  const [pending, setPending] = useState<{ order: ActionableOrder; action: OrderAction } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  async function run(order: ActionableOrder, action: OrderAction, notes: string) {
    setBusyId(order.id);
    setNotice(null);
    try {
      if (action.kind === "deliver") {
        await request(`/api/admin/orders/${order.id}/delivered`, { method: "POST" });
      } else {
        await request(`/api/admin/orders/${order.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action.to, notes: notes || (action.to === "paid" ? "Pago confirmado manualmente por el administrador." : undefined) }),
        });
      }
      setNotice({
        error: false,
        text: action.kind === "deliver" ? `Pedido ${shortOrderId(order.id)} entregado.`
          : action.to === "paid" ? `Pago del pedido ${shortOrderId(order.id)} confirmado. Ya está en «Por entregar».`
            : `Pedido ${shortOrderId(order.id)} actualizado.`,
      });
    } catch (cause) {
      setNotice({ error: true, text: cause instanceof Error ? cause.message : "No fue posible actualizar el pedido." });
    } finally {
      // También tras un error: una entrega pudo avanzar algunos estados antes de detenerse.
      refreshCounts();
      await reload();
      setBusyId(null);
    }
  }

  const action = pending?.action;
  const order = pending?.order;
  const copy = !action || !order ? null : action.kind === "deliver" ? {
    title: "Marcar como entregado",
    description: `Confirma que ya enviaste en Fortnite todos los objetos del pedido ${shortOrderId(order.id)} a ${order.epic_display_name}. El cliente verá su pedido como entregado y esto no se puede deshacer.`,
    confirmLabel: "Sí, ya lo entregué",
  } : action.to === "paid" ? {
    title: "Confirmar pago",
    description: `Confirma que el depósito de ${formatOrderMoney(order)} del pedido ${shortOrderId(order.id)} ya aparece en la cuenta del banco. El pedido pasará a «Por entregar».`,
    confirmLabel: "Sí, el pago llegó",
  } : {
    title: action.label,
    description: `Pedido ${shortOrderId(order.id)} · ${formatOrderMoney(order)} ·${order.epic_display_name}`,
    confirmLabel: action.label,
  };
  const requiresNote = action?.kind === "status" && action.requiresNote;

  const modal = <AdminActionModal
    open={Boolean(pending)} onClose={() => setPending(null)}
    title={copy?.title ?? "Confirmar operación"} description={copy?.description ?? ""} confirmLabel={copy?.confirmLabel ?? "Confirmar"}
    tone={action?.tone === "danger" ? "danger" : "primary"}
    notesLabel={requiresNote ? "Motivo para el cliente" : undefined} notesPlaceholder="Explica brevemente el motivo; el cliente lo verá en su pedido." notesRequired={Boolean(requiresNote)}
    busy={Boolean(busyId)}
    onConfirm={(notes) => { if (!pending) return; const next = pending; setPending(null); void run(next.order, next.action, notes); }}
  />;

  return { ask: (target: ActionableOrder, next: OrderAction) => setPending({ order: target, action: next }), busyId, notice, modal };
}
