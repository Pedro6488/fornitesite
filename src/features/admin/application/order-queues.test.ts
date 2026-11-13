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
    expect(manualDeliverySteps("receipt_submitted")).toEqual([]);
    expect(manualDeliverySteps("delivered")).toEqual([]);
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
