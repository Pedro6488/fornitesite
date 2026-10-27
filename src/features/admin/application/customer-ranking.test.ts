import { describe, expect, it } from "vitest";
import { rankCustomersByDeliveredOrders } from "./customer-ranking";

describe("rankCustomersByDeliveredOrders", () => {
  it("cuenta entregas por destinatario y conserva el correo de la entrega más reciente", () => {
    const ranking = rankCustomersByDeliveredOrders([
      { epic_account_id: "manual:b", epic_display_name: "qa_test", customer_email: "older@example.com", amount_mxn_cents: 12_000, delivered_at: "2026-10-01T12:00:00.000Z", created_at: "2026-10-01T10:00:00.000Z" },
      { epic_account_id: "manual:a", epic_display_name: "test15octubre", customer_email: "a@example.com", amount_mxn_cents: 8_000, delivered_at: "2026-10-03T12:00:00.000Z", created_at: "2026-10-03T10:00:00.000Z" },
      { epic_account_id: "manual:b", epic_display_name: "qa_test", customer_email: "newer@example.com", amount_mxn_cents: 15_000, delivered_at: "2026-10-04T12:00:00.000Z", created_at: "2026-10-04T10:00:00.000Z" },
    ]);

    expect(ranking).toEqual([
      { recipientName: "qa_test", customerEmail: "newer@example.com", deliveredOrders: 2 },
      { recipientName: "test15octubre", customerEmail: "a@example.com", deliveredOrders: 1 },
    ]);
  });

  it("desempata por el importe total de las compras recibidas", () => {
    const ranking = rankCustomersByDeliveredOrders([
      { epic_account_id: "manual:low", epic_display_name: "Cliente menor", customer_email: null, amount_mxn_cents: 8_000, delivered_at: "2026-10-02T12:00:00.000Z", created_at: "2026-10-02T10:00:00.000Z" },
      { epic_account_id: "manual:high", epic_display_name: "Cliente mayor", customer_email: null, amount_mxn_cents: 16_000, delivered_at: "2026-10-02T12:00:00.000Z", created_at: "2026-10-02T10:00:00.000Z" },
    ]);

    expect(ranking.map((customer) => customer.recipientName)).toEqual(["Cliente mayor", "Cliente menor"]);
  });
});
