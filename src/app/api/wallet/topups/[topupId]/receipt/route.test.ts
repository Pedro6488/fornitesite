// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const TOPUP_ID = "abcdef12-0000-4000-8000-000000000000";
const mocks = vi.hoisted(() => ({ walletContext: vi.fn(), alert: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@/features/wallet/server/context", () => ({ walletContext: mocks.walletContext }));
vi.mock("@/features/fnshop/server/get-fnshop-client", () => ({ sendOperationsAlert: mocks.alert }));
vi.mock("@/shared/server/commerce-rate-limit", () => ({ consumeCommerceRateLimit: mocks.rateLimit }));

/** Base falsa: cada consulta encadenada termina en `maybeSingle`, que entrega los resultados en orden. */
function fakeDatabase(results: { data: unknown; error: unknown }[]) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "update"]) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => results.shift());
  const bucket = { upload: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })) };
  return { from: vi.fn(() => query), storage: { from: vi.fn(() => bucket) }, bucket };
}

const topup = { id: TOPUP_ID, status: "awaiting_payment", expires_at: "2099-01-01T00:00:00Z", vbucks: 5000, bonus_vbucks: 250, amount_cents: 22500, region: "mx", reference_code: "RECARGA-ABCDEF12" };
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
function upload() {
  const form = new FormData();
  form.set("receipt", new File([png], "pago.png", { type: "image/png" }));
  return POST(new Request(`http://localhost/api/wallet/topups/${TOPUP_ID}/receipt`, { method: "POST", body: form }), { params: Promise.resolve({ topupId: TOPUP_ID }) });
}

describe("comprobante de una recarga de pavos", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.rateLimit.mockResolvedValue(true); });

  // Regla: todo paso en que el cliente queda esperando a la tienda avisa al equipo, como el comprobante de un pedido.
  it("avisa al admin por Telegram que hay pavos por liberar, con referencia, regalo y monto", async () => {
    mocks.walletContext.mockResolvedValue({ database: fakeDatabase([{ data: topup, error: null }, { data: { id: TOPUP_ID }, error: null }]), user: { id: "user-1", email: "cliente@example.com" } });
    const response = await upload();
    expect(response.status).toBe(200);
    expect(mocks.alert).toHaveBeenCalledTimes(1);
    const [, text, dedupeKey, path] = mocks.alert.mock.calls[0];
    expect(text).toMatch(/Recarga de pavos por liberar · RECARGA-ABCDEF12/);
    expect(text).toMatch(/5,000 \+ 250 de regalo/);
    expect(text).toMatch(/\$225\.00 MXN/);
    expect(text).toMatch(/cliente@example\.com/);
    expect(dedupeKey).toBe(`wallet:topup:submitted:${TOPUP_ID}`);
    expect(path).toBe("/admin/pavos");
  });

  it("si Telegram falla, el comprobante ya quedó guardado y el cliente ve éxito", async () => {
    mocks.walletContext.mockResolvedValue({ database: fakeDatabase([{ data: topup, error: null }, { data: { id: TOPUP_ID }, error: null }]), user: { id: "user-1", email: null } });
    mocks.alert.mockRejectedValue(new Error("telegram caído"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await upload()).status).toBe(200);
  });

  it("no avisa si el comprobante no se pudo registrar", async () => {
    const database = fakeDatabase([{ data: topup, error: null }, { data: null, error: { code: "23505" } }]);
    mocks.walletContext.mockResolvedValue({ database, user: { id: "user-1", email: null } });
    expect((await upload()).status).toBe(409);
    expect(database.bucket.remove).toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
  });
});
