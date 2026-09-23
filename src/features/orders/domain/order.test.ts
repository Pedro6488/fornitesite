import { describe, expect, it } from "vitest";
import { assertOrderTransition, InvalidOrderTransitionError } from "./order";

describe("order state machine", () => {
  it.each([
    ["draft", "payment_pending"], ["draft", "awaiting_transfer"], ["payment_pending", "paid"],
    ["transfer_review", "paid"], ["paid", "ready_to_send"], ["ready_to_send", "validating_delivery"],
    ["validating_delivery", "delivering"], ["delivering", "delivered"]
  ] as const)("permite %s → %s", (from, to) => expect(() => assertOrderTransition(from, to)).not.toThrow());

  it("impide entregar una orden pendiente de pago", () => expect(() => assertOrderTransition("payment_pending", "delivered")).toThrow(InvalidOrderTransitionError));
  it("impide repetir una orden entregada", () => expect(() => assertOrderTransition("delivered", "delivering")).toThrow(InvalidOrderTransitionError));
});
