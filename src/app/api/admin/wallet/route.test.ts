// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const auth = vi.hoisted(() => ({ authorizeStaff: vi.fn() }));
vi.mock("@/shared/server/authorize-staff", () => auth);

const post = (body: unknown) => new Request("http://localhost/api/admin/wallet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function setup(saved: { cost_cents_per_100: number | null; min_margin_bp: number } = { cost_cents_per_100: null, min_margin_bp: 0 }) {
  const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
  const insert = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => ({ update, insert, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: saved, error: null }) }) }) }));
  auth.authorizeStaff.mockResolvedValue({ user: { id: "00000000-0000-4000-8000-000000000001" }, database: { from } });
  return { update };
}

describe("tarifa base de pavos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no deja activar una tarifa debajo de costo + margen y explica el mínimo", async () => {
    const { update } = setup();
    const response = await POST(post({ action: "rate", region: "mx", centsPer100: 900, active: true, costCentsPer100: 1000, minMarginBp: 100 }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("El mínimo es $10.10");
    expect(update).not.toHaveBeenCalled();
  });

  it("usa el costo ya guardado si el formulario no lo manda", async () => {
    setup({ cost_cents_per_100: 800, min_margin_bp: 1000 });
    expect((await POST(post({ action: "rate", region: "mx", centsPer100: 870, active: true }))).status).toBe(409);
    expect((await POST(post({ action: "rate", region: "mx", centsPer100: 900, active: true }))).status).toBe(200);
  });

  it("guarda $9 con un costo menor, sin costo capturado o con la región apagada", async () => {
    const { update } = setup();
    expect((await POST(post({ action: "rate", region: "mx", centsPer100: 900, active: true, costCentsPer100: 700, minMarginBp: 1000 }))).status).toBe(200);
    expect((await POST(post({ action: "rate", region: "mx", centsPer100: 900, active: true, costCentsPer100: null, minMarginBp: 0 }))).status).toBe(200);
    expect((await POST(post({ action: "rate", region: "mx", centsPer100: 500, active: false, costCentsPer100: 1000, minMarginBp: 0 }))).status).toBe(200);
    expect(update).toHaveBeenCalledTimes(3);
  });
});
