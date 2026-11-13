import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "@/features/orders/domain/order";
import { ORDER_QUEUES, legacyAdminPath, manualDeliverySteps, primaryActionOf, queueOf, secondaryActionsOf } from "./order-queues";

describe("order queues", () => {
  it("places every order status in exactly one queue", () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_QUEUES.filter((queue) => queue.statuses.includes(status)), status).toHaveLength(1);
    }
  });

  it("sends receipts to the payment queue and paid orders to the delivery queue", () => {
    expect(queueOf("receipt_submitted")).toBe("payment");
    expect(queueOf("paid")).toBe("deliver");
    expect(queueOf("delivering")).toBe("deliver");
    expect(queueOf("manual_review")).toBe("problem");
    expect(queueOf("delivered")).toBe("closed");
  });
});

describe("order actions", () => {
  it("offers payment confirmation as the single primary action before payment", () => {
    for (const status of ["awaiting_transfer", "receipt_submitted", "transfer_review", "information_required"] as const) {
      expect(primaryActionOf(status)).toMatchObject({ kind: "status", to: "paid" });
      expect(secondaryActionsOf(status).some((action) => action.kind === "status" && action.to === "paid")).toBe(false);
    }
  });

  it("offers one delivery action for every paid status", () => {
    for (const status of ["paid", "ready_to_send", "validating_delivery", "delivering", "reconciling"] as const) {
      expect(primaryActionOf(status)).toMatchObject({ kind: "deliver" });
    }
  });

  it("has no actions for closed orders", () => {
    for (const status of ["delivered", "refunded", "rejected", "expired", "canceled"] as const) {
      expect(primaryActionOf(status)).toBeNull();
      expect(secondaryActionsOf(status)).toHaveLength(0);
    }
  });

  it("requires a note for the changes the customer reads", () => {
    const actions = secondaryActionsOf("transfer_review");
    expect(actions.find((action) => action.kind === "status" && action.to === "rejected")).toMatchObject({ requiresNote: true, tone: "danger" });
    expect(actions.find((action) => action.kind === "status" && action.to === "information_required")).toMatchObject({ requiresNote: true });
  });

  it("walks every remaining state to reach delivered", () => {
    expect(manualDeliverySteps("paid")).toEqual(["ready_to_send", "validating_delivery", "delivering", "delivered"]);
    expect(manualDeliverySteps("delivering")).toEqual(["delivered"]);
    expect(manualDeliverySteps("reconciling")).toEqual(["delivered"]);
    expect(manualDeliverySteps("manual_review")).toEqual(["delivered"]);
    expect(manualDeliverySteps("receipt_submitted")).toEqual([]);
    expect(manualDeliverySteps("delivered")).toEqual([]);
  });

  it("keeps manual review on its own primary action in manual mode, with hand delivery as an option", () => {
    expect(primaryActionOf("manual_review")).toMatchObject({ kind: "status", to: "awaiting_transfer" });
    expect(secondaryActionsOf("manual_review").map((action) => action.kind === "status" ? action.to : action.kind)).toEqual(["deliver", "refund_pending", "canceled"]);
  });
});

describe("order actions with automatic delivery", () => {
  it("confirms the payment and sends the gift in one flow, keeping «Solo confirmar pago»", () => {
    for (const status of ["awaiting_transfer", "receipt_submitted", "transfer_review", "information_required"] as const) {
      expect(primaryActionOf(status, "automatic")).toEqual({ kind: "send", label: "Confirmar pago y enviar regalo", tone: "primary", confirmPayment: true });
      expect(secondaryActionsOf(status, "automatic").find((action) => action.kind === "status" && action.to === "paid")?.label).toBe("Solo confirmar pago");
    }
  });

  it("sends from paid, retries from manual review and reconciles doubtful sends", () => {
    expect(primaryActionOf("paid", "automatic")).toMatchObject({ kind: "send", confirmPayment: false, label: "Enviar regalo" });
    expect(primaryActionOf("manual_review", "automatic")).toMatchObject({ kind: "send", label: "Reintentar envío" });
    expect(primaryActionOf("reconciling", "automatic")).toMatchObject({ kind: "reconcile" });
  });

  it("shows no button while the system is sending, except reconciling a stuck send", () => {
    expect(primaryActionOf("delivering", "automatic")).toBeNull();
    expect(secondaryActionsOf("delivering", "automatic").map((action) => action.kind)).toEqual(["reconcile", "status"]);
  });

  it("never offers the intermediate delivery states by hand", () => {
    for (const status of ["paid", "ready_to_send", "validating_delivery", "delivering", "reconciling", "manual_review"] as const) {
      const targets = secondaryActionsOf(status, "automatic").flatMap((action) => action.kind === "status" ? [action.to] : []);
      expect(targets.some((to) => ["ready_to_send", "validating_delivery", "delivering", "reconciling", "delivered"].includes(to)), status).toBe(false);
    }
  });

  it("keeps hand delivery available for gifts sent outside the system", () => {
    expect(secondaryActionsOf("paid", "automatic")[0]).toMatchObject({ kind: "deliver", label: "Marcar como entregado a mano" });
  });
});

describe("legacy admin links", () => {
  const orderId = "7f3a91c2-1111-4222-8333-444455556666";

  it("sends old Telegram order links to the order page", () => {
    expect(legacyAdminPath({ tab: "orders", order: orderId })).toBe(`/admin/pedidos/${orderId}`);
  });

  it("maps old tabs to their sections", () => {
    expect(legacyAdminPath({ tab: "identities" })).toBe("/admin/destinatarios");
    expect(legacyAdminPath({ tab: "prices" })).toBe("/admin/precios");
    expect(legacyAdminPath({ tab: "carts", cart: orderId })).toBe(`/admin/carritos?cart=${orderId}`);
  });

  it("does not redirect the home page or unknown values", () => {
    expect(legacyAdminPath({})).toBeNull();
    expect(legacyAdminPath({ tab: "summary" })).toBeNull();
    expect(legacyAdminPath({ tab: "nope", order: "../../evil" })).toBeNull();
  });
});
