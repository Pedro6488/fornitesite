import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Order } from "../domain/order";
import { OrderStatus } from "./order-status";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const order: Order = {
  id: "order-a", publicToken: "token", status: "awaiting_transfer", customerEmail: null,
  epicAccountId: "epic-a", epicDisplayName: "Player", itemMainId: "item-a", offerId: "offer-a",
  itemName: "Objeto", itemImageUrl: null, vbucksPrice: 500, amountMxnCents: 4000,
  paymentMethod: "bank_transfer", createdAt: "2026-11-17T12:00:00Z",
};
const bank = { name: "Nu", beneficiary: "Tienda", clabe: "123456789012345678", concept: "Pedido", paypal: "pagos@example.com" };

describe("datos de pago por región del pedido", () => {
  it.each(["receipt_submitted", "transfer_review"] as const)("explica el plazo de entrega durante %s", (status) => {
    render(<OrderStatus initialOrder={{ ...order, status }} bank={bank} whatsappNumber={null} appUrl="https://example.com" />);
    expect(screen.getByText(/Tu pago está en revisión.*1 a 10 minutos.*Gracias por tu paciencia/)).toBeInTheDocument();
  });
  it("muestra únicamente transferencia en México", () => {
    render(<OrderStatus initialOrder={{ ...order, currency: "MXN" }} bank={bank} whatsappNumber={null} appUrl="https://example.com" />);
    expect(screen.getByText(bank.clabe)).toBeInTheDocument();
    expect(screen.queryByText(bank.paypal)).not.toBeInTheDocument();
    expect(screen.queryByText("PayPal")).not.toBeInTheDocument();
  });
  it("muestra únicamente PayPal en USA", () => {
    render(<OrderStatus initialOrder={{ ...order, currency: "USD", amountUsdCents: 500 }} bank={bank} whatsappNumber={null} appUrl="https://example.com" />);
    expect(screen.getByText(bank.paypal)).toBeInTheDocument();
    expect(screen.queryByText(bank.clabe)).not.toBeInTheDocument();
    expect(screen.queryByText("Banco")).not.toBeInTheDocument();
    expect(screen.getByText("Pendiente de pago por PayPal")).toBeInTheDocument();
  });
});
