import { GET } from "./route";
import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./[userId]/password/route";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), listUsers: vi.fn(), getUser: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock("@/shared/server/authorize-staff", () => ({ authorizeStaffWithReason: mocks.authorize }));
const id = "00000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ userId: id }) };
function passwordRequest(password = "new-secret-123") {
  return new Request("https://example.com/api/admin/users/password", { method: "POST", body: JSON.stringify({ password }), headers: { "Content-Type": "application/json" } });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({ ok: true, user: { id: "admin" }, database: {
    auth: { admin: { listUsers: mocks.listUsers, getUserById: mocks.getUser, updateUserById: mocks.update } },
    from: () => ({ insert: mocks.insert }),
  } });
  mocks.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
  mocks.update.mockResolvedValue({ error: null });
  mocks.insert.mockResolvedValue({ error: null });
});

it.each([401, 403])("rechaza listar y modificar sin autorización (%s)", async (status) => {
  mocks.authorize.mockResolvedValue({ ok: false, status });
  expect((await GET(new Request("https://example.com/api/admin/users"))).status).toBe(status);
  expect((await POST(passwordRequest(), context)).status).toBe(status);
  expect(mocks.listUsers).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});

it("lista identificadores de acceso sin filtrar metadatos privados ni correos sintéticos", async () => {
  mocks.listUsers.mockResolvedValue({ error: null, data: { users: [
    { id, email: "cliente@accounts.sigfriedlootbox.local", created_at: "2026-11-01", user_metadata: { secret: "private" } },
    { id: "other", email: "real@example.com", created_at: "2026-11-02" },
  ] } });
  const response = await GET(new Request("https://example.com/api/admin/users?page=12"));
  const body = await response.json();
  expect(mocks.listUsers).toHaveBeenCalledWith({ page: 12, perPage: 50 });
  expect(body.users.map((u: { login: string }) => u.login)).toEqual(["cliente", "real@example.com"]);
  expect(JSON.stringify(body)).not.toContain("private");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});

it("valida la contraseña antes de modificar la cuenta", async () => {
  expect((await POST(passwordRequest("short"), context)).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});

it("registra actor y cuenta, pero nunca la contraseña", async () => {
  const response = await POST(passwordRequest(), context);
  expect(response.status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith(id, { password: "new-secret-123" });
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ actor_id: "admin", entity_id: id, action: "user.password_changed" }));
  expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain("new-secret-123");
  expect(JSON.stringify(await response.json())).not.toContain("new-secret-123");
});

it("no cambia la contraseña si no puede registrar la solicitud", async () => {
  mocks.insert.mockResolvedValue({ error: { message: "unavailable" } });
  expect((await POST(passwordRequest(), context)).status).toBe(503);
  expect(mocks.update).not.toHaveBeenCalled();
});

it("no anuncia éxito si el proveedor rechaza la contraseña", async () => {
  mocks.update.mockResolvedValue({ error: { message: "weak" } });
  expect((await POST(passwordRequest(), context)).status).toBe(400);
  expect(mocks.insert).toHaveBeenCalledTimes(1);
});
