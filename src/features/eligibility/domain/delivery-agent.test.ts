import { describe, expect, it } from "vitest";
import { evaluateAgent, evaluateAgentForCart, selectBestAgent, selectBestAgentForCart, type DeliveryAgent } from "./delivery-agent";

const ready = (overrides: Partial<DeliveryAgent> = {}): DeliveryAgent => ({
  id: "a", publicAlias: "Agente 1", vbucksBalance: 2_000, giftsUsed: 0, giftsLimit: 5,
  friendship: "ready", giftableAt: null, healthy: true, ...overrides
});

describe("agent eligibility", () => {
  it("acepta un agente saludable con amistad, cupo y saldo", () => expect(evaluateAgent(ready(), 1_500).available).toBe(true));
  it("rechaza saldo insuficiente", () => expect(evaluateAgent(ready({ vbucksBalance: 500 }), 1_500).reason).toBe("Saldo insuficiente"));
  it("rechaza cupo agotado", () => expect(evaluateAgent(ready({ giftsUsed: 5 }), 1_500).available).toBe(false));
  it("explica una amistad pendiente", () => expect(evaluateAgent(ready({ friendship: "pending" }), 1_500).reason).toContain("Acepta"));
  it("explica una amistad en espera", () => expect(evaluateAgent(ready({ friendship: "waiting", giftableAt: new Date(Date.now() + 3_600_000).toISOString() }), 1_500).reason).toContain("Disponible"));
  it("rechaza agentes no saludables", () => expect(evaluateAgent(ready({ healthy: false }), 1_500).available).toBe(false));
  it("elige el saldo suficiente más ajustado", () => {
    const selected = selectBestAgent([ready({ id: "large", vbucksBalance: 10_000 }), ready({ id: "best", vbucksBalance: 1_800 })], 1_500);
    expect(selected?.id).toBe("best");
  });
  it("devuelve null cuando nadie cumple", () => expect(selectBestAgent([ready({ vbucksBalance: 10 })], 1_500)).toBeNull());
  it("rechaza un agente sin cupo para todas las líneas del carrito", () => {
    expect(evaluateAgentForCart(ready({ giftsUsed: 4 }), 1_000, 2).available).toBe(false);
  });
  it("elige un agente con saldo y cupo para el carrito completo", () => {
    const selected = selectBestAgentForCart([ready({ id: "full", giftsUsed: 4 }), ready({ id: "roomy", vbucksBalance: 5_000 })], 2_000, 3);
    expect(selected?.id).toBe("roomy");
  });
});
