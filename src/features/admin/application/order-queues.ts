import type { OrderStatus } from "@/features/orders/domain/order";

/**
 * Colas de trabajo de la consola. Cada pedido vive en exactamente una cola y
 * cada cola responde una pregunta: ¿qué tiene que hacer el administrador?
 */
export type OrderQueueId = "payment" | "deliver" | "problem" | "closed";

export const ORDER_QUEUES: readonly { id: OrderQueueId; label: string; hint: string; statuses: readonly OrderStatus[] }[] = [
  {
    id: "payment",
    label: "Por confirmar pago",
    hint: "Compara el comprobante con el banco y confirma el pago.",
    statuses: ["receipt_submitted", "transfer_review", "information_required", "awaiting_transfer", "payment_pending", "draft"],
  },
  {
    id: "deliver",
    label: "Por entregar",
    hint: "Pago confirmado. Envía el regalo y márcalo como entregado.",
    statuses: ["paid", "ready_to_send", "validating_delivery", "delivering"],
  },
  {
    id: "problem",
    label: "Con problema",
    hint: "Pedidos detenidos que necesitan una decisión.",
    statuses: ["reconciling", "manual_review", "refund_pending"],
  },
  {
    id: "closed",
    label: "Cerrados",
    hint: "Entregados, reembolsados, declinados, vencidos y cancelados.",
    statuses: ["delivered", "refunded", "rejected", "expired", "canceled"],
  },
];

/** Estados en los que el cliente ya hizo su parte y el pedido espera al administrador. */
export const RECEIPT_REVIEW_STATUSES: readonly OrderStatus[] = ["receipt_submitted", "transfer_review"];

/** Un pedido cuenta como venta mientras esté en uno de estos estados. */
export const SALE_STATUSES: readonly OrderStatus[] = ["paid", "ready_to_send", "validating_delivery", "delivering", "reconciling", "delivered"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Borrador", payment_pending: "Pago pendiente", awaiting_transfer: "Esperando transferencia",
  receipt_submitted: "Comprobante recibido", transfer_review: "Comprobante en revisión", information_required: "Requiere información",
  paid: "Pagado", ready_to_send: "Listo para enviar", validating_delivery: "Validando entrega", delivering: "Enviando",
  reconciling: "Conciliando", delivered: "Entregado", manual_review: "Revisión manual", refund_pending: "Reembolso pendiente",
  refunded: "Reembolsado", rejected: "Declinado", expired: "Vencido", canceled: "Cancelado",
};

export const ORDER_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  awaiting_transfer: "Volver a pedir transferencia",
  transfer_review: "Dejar comprobante en revisión",
  information_required: "Pedir información al cliente",
  paid: "Confirmar pago",
  ready_to_send: "Avanzar a «Listo para enviar»",
  validating_delivery: "Avanzar a «Validando entrega»",
  delivering: "Avanzar a «Enviando»",
  reconciling: "Pasar a conciliación",
  delivered: "Marcar como entregado",
  manual_review: "Pasar a revisión manual",
  refund_pending: "Iniciar reembolso",
  refunded: "Confirmar reembolso",
  rejected: "Declinar pago",
  canceled: "Cancelar pedido",
};

/** Cambios de estado que el administrador puede pedir desde cada estado. */
const NEXT_STATUSES: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  awaiting_transfer: ["paid", "canceled"],
  receipt_submitted: ["paid", "transfer_review"],
  transfer_review: ["paid", "information_required", "rejected"],
  information_required: ["paid", "rejected", "canceled"],
  paid: ["ready_to_send", "manual_review", "refund_pending"],
  ready_to_send: ["validating_delivery", "manual_review", "refund_pending"],
  validating_delivery: ["delivering", "manual_review", "refund_pending"],
  delivering: ["delivered", "reconciling", "manual_review"],
  reconciling: ["delivered", "manual_review"],
  manual_review: ["awaiting_transfer", "refund_pending", "canceled"],
  refund_pending: ["refunded", "manual_review"],
};

/** Motivo obligatorio: el cliente lo lee en su pedido. */
export const STATUSES_REQUIRING_NOTE: readonly OrderStatus[] = ["information_required", "rejected", "canceled"];

const MANUAL_DELIVERY_PATH: readonly OrderStatus[] = ["paid", "ready_to_send", "validating_delivery", "delivering", "delivered"];

export function queueOf(status: OrderStatus): OrderQueueId {
  return ORDER_QUEUES.find((queue) => queue.statuses.includes(status))?.id ?? "problem";
}

export function statusesOf(queue: OrderQueueId): readonly OrderStatus[] {
  return ORDER_QUEUES.find((entry) => entry.id === queue)?.statuses ?? [];
}

/**
 * Estados que hay que recorrer para dejar un pedido pagado como entregado.
 * La entrega manual pasa por todos para que el historial y los avisos al
 * cliente queden igual que si se hubiera avanzado paso por paso.
 */
export function manualDeliverySteps(from: OrderStatus): readonly OrderStatus[] {
  if (from === "reconciling" || from === "manual_review") return ["delivered"];
  const index = MANUAL_DELIVERY_PATH.indexOf(from);
  return index === -1 ? [] : MANUAL_DELIVERY_PATH.slice(index + 1);
}

export type DeliveryMode = "manual" | "automatic";

export type OrderAction =
  | { kind: "status"; to: OrderStatus; label: string; tone: "primary" | "neutral" | "danger"; requiresNote: boolean }
  /** Entrega a mano: el regalo ya se envió en Fortnite y el pedido recorre los estados que faltan. */
  | { kind: "deliver"; label: string; tone: "primary" | "neutral" }
  /** Entrega automática con FN Shop: pre-vuelo y envío. Con `confirmPayment`, antes confirma el pago. */
  | { kind: "send"; label: string; tone: "primary"; confirmPayment: boolean }
  /** Busca en el historial de FN Shop los envíos con resultado dudoso. */
  | { kind: "reconcile"; label: string; tone: "primary" | "neutral" };

const PAYMENT_CONFIRMABLE: readonly OrderStatus[] = ["awaiting_transfer", "receipt_submitted", "transfer_review", "information_required"];

function statusAction(to: OrderStatus): Extract<OrderAction, { kind: "status" }> {
  return {
    kind: "status",
    to,
    label: ORDER_ACTION_LABELS[to] ?? ORDER_STATUS_LABELS[to],
    tone: to === "rejected" || to === "canceled" ? "danger" : to === "paid" || to === "refunded" ? "primary" : "neutral",
    requiresNote: STATUSES_REQUIRING_NOTE.includes(to),
  };
}

/** El único botón principal de un pedido: el paso que lo saca de su cola. */
export function primaryActionOf(status: OrderStatus, mode: DeliveryMode = "manual"): OrderAction | null {
  if (mode === "automatic") {
    if (PAYMENT_CONFIRMABLE.includes(status)) return { kind: "send", label: "Confirmar pago y enviar regalo", tone: "primary", confirmPayment: true };
    if (status === "paid" || status === "ready_to_send") return { kind: "send", label: "Enviar regalo", tone: "primary", confirmPayment: false };
    if (status === "manual_review") return { kind: "send", label: "Reintentar envío", tone: "primary", confirmPayment: false };
    if (status === "reconciling") return { kind: "reconcile", label: "Conciliar", tone: "primary" };
    // validating_delivery y delivering: el sistema está enviando.
    if (status === "validating_delivery" || status === "delivering") return null;
  }
  if (status !== "manual_review" && manualDeliverySteps(status).length > 0) return { kind: "deliver", label: "Marcar como entregado", tone: "primary" };
  const next = NEXT_STATUSES[status] ?? [];
  if (next.includes("paid")) return statusAction("paid");
  if (status === "refund_pending") return statusAction("refunded");
  if (status === "manual_review") return { ...statusAction("awaiting_transfer"), tone: "primary" };
  return null;
}

/** El resto de cambios permitidos; se muestran bajo «Otras acciones». */
export function secondaryActionsOf(status: OrderStatus, mode: DeliveryMode = "manual"): readonly OrderAction[] {
  const primary = primaryActionOf(status, mode);
  const actions: OrderAction[] = [];
  if (mode === "automatic") {
    if (status === "delivering") actions.push({ kind: "reconcile", label: "Conciliar (si lleva varios minutos así)", tone: "neutral" });
    // Entregar a mano sigue disponible: por ejemplo, si el regalo se mandó desde la miniapp.
    if (["paid", "ready_to_send", "reconciling", "manual_review"].includes(status)) actions.push({ kind: "deliver", label: "Marcar como entregado a mano", tone: "neutral" });
  } else if (status === "manual_review") {
    actions.push({ kind: "deliver", label: "Marcar como entregado", tone: "neutral" });
  }
  const statuses = (NEXT_STATUSES[status] ?? [])
    .filter((to) => !(primary?.kind === "status" && primary.to === to))
    .filter((to) => to !== "delivered" || !(primary?.kind === "deliver" || actions.some((action) => action.kind === "deliver")))
    // En automático los pasos intermedios los recorre el envío; no se ofrecen a mano.
    .filter((to) => mode === "manual" || !["ready_to_send", "validating_delivery", "delivering", "delivered", "reconciling"].includes(to))
    .map((to) => to === "paid" && mode === "automatic" ? { ...statusAction("paid"), label: "Solo confirmar pago", tone: "neutral" as const } : statusAction(to));
  return [...actions, ...statuses];
}

const LEGACY_TAB_PATHS: Record<string, string> = {
  summary: "/admin", orders: "/admin/pedidos", identities: "/admin/destinatarios", carts: "/admin/carritos",
  favorites: "/admin/favoritos", prices: "/admin/precios", customers: "/admin/clientes", references: "/admin/referencias",
};

/**
 * Los avisos de Telegram ya enviados apuntan a `/admin?tab=…&order=…`.
 * Devuelve la ruta nueva equivalente, o `null` si no hay nada que redirigir.
 */
export function legacyAdminPath(params: { tab?: string | null; order?: string | null; cart?: string | null }): string | null {
  if (params.order && /^[0-9a-f-]{36}$/i.test(params.order)) return `/admin/pedidos/${params.order}`;
  if (params.cart && /^[0-9a-f-]{36}$/i.test(params.cart)) return `/admin/carritos?cart=${params.cart}`;
  const path = params.tab ? LEGACY_TAB_PATHS[params.tab] : null;
  return path && path !== "/admin" ? path : null;
}
