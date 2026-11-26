import { beforeEach, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), upsert: vi.fn(), rows: [] as unknown[], error: null as null | { code: string } }));
vi.mock("@/shared/server/authorize-staff", () => ({ authorizeStaffWithReason: mocks.auth }));
vi.mock("@/features/catalog/server/get-catalog", () => ({ getCatalogService: async () => ({ list: mocks.list }) }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.rows = []; mocks.error = null;
  mocks.list.mockResolvedValue([
    { mainId: "1", name: "Uno", type: "Atuendo", collaboration: " ES HORA DE ANOTAR " },
    { mainId: "2", name: "Dos", type: "Atuendo", collaboration: "ES HORA DE ANOTAR" },
    { mainId: "3", name: "Tres", type: "Atuendo", collaboration: "Miku" },
    { mainId: "4", name: "Cuatro", type: "Atuendo" },
  ]);
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.auth.mockResolvedValue({ ok: true, user: { id: "admin" }, database: { from: () => ({
    select: () => ({ order: async () => ({ data: mocks.rows, error: mocks.error }) }), upsert: mocks.upsert,
  }) } });
});
const request = (body: unknown) => new Request("https://example.com/api/admin/prices/collections", { method: "PUT", body: JSON.stringify(body) });
it.each([401, 403])("requiere administrador para listar y guardar (%s)", async (status) => {
  mocks.auth.mockResolvedValue({ ok: false, status });
  expect((await GET(new Request("https://example.com"))).status).toBe(status);
  expect((await PUT(request({}))).status).toBe(status);
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it("devuelve todos los apartados del catálogo con la misma agrupación pública", async () => {
  const response = await GET(new Request("https://example.com"));
  expect((await response.json()).sections).toEqual([{ name: "ES HORA DE ANOTAR", count: 2 }, { name: "Miku", count: 1 }, { name: "Otros objetos", count: 1 }]);
});
it("guarda una sola regla para el apartado completo", async () => {
  expect((await PUT(request({ collection: "ES HORA DE ANOTAR", mxnPerHundred: 12.5, active: true }))).status).toBe(200);
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ collection: "ES HORA DE ANOTAR", mxn_per_hundred: 12.5, active: true, updated_by: "admin" }), { onConflict: "collection" });
});
it.each([0, -1, 100000000, 10.001])("rechaza tarifas inválidas %s", async (mxnPerHundred) => {
  expect((await PUT(request({ collection: "Miku", mxnPerHundred, active: true }))).status).toBe(400);
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it("rechaza apartados inexistentes pero permite desactivar reglas antiguas", async () => {
  expect((await PUT(request({ collection: "Antigua", mxnPerHundred: 10, active: true }))).status).toBe(409);
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect((await PUT(request({ collection: "Antigua", mxnPerHundred: 10, active: false }))).status).toBe(200);
});
it("explica cuando falta aplicar la migración", async () => {
  mocks.error = { code: "PGRST205" };
  const body = await (await GET(new Request("https://example.com"))).json();
  expect(body.configured).toBe(false);
  expect(body.sections).toHaveLength(3);
});
