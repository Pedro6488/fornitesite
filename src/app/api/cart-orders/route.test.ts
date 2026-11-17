import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const session = vi.hoisted(() => ({ requireCommerceSession: vi.fn() }));
vi.mock("@/shared/server/commerce-session", () => ({ ...session, attachCommerceCookie: vi.fn() }));

describe("validación del teléfono al crear una compra", () => {
  it.each(["5255123456789", "55abcd1234", "1234567", "+525512345678"])("rechaza el teléfono inválido %s antes de crear el pedido", async (whatsapp) => {
    session.requireCommerceSession.mockClear();
    const id = "00000000-0000-4000-8000-000000000001";
    const response = await POST(new Request("http://localhost/api/cart-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: id, validationId: id, idempotencyKey: id, whatsapp }),
    }));
    expect(response.status).toBe(400);
    expect(session.requireCommerceSession).not.toHaveBeenCalled();
  });
});
