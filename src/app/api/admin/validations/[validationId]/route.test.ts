import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const auth = vi.hoisted(() => ({ authorizeStaffWithReason: vi.fn() }));
vi.mock("@/shared/server/authorize-staff", () => auth);

function staffFor(validation: { status: string; giftable_at: string | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: validation, error: null });
  const database = {
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })),
    rpc,
  };
  auth.authorizeStaffWithReason.mockResolvedValue({
    ok: true,
    user: { id: "00000000-0000-4000-8000-000000000001" },
    role: "admin",
    database,
  });
  return { rpc };
}

function request(body: unknown) {
  return new Request("http://localhost/api/admin/validations/00000000-0000-4000-8000-000000000002", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ validationId: "00000000-0000-4000-8000-000000000002" }) };

describe("PATCH admin validation", () => {
  beforeEach(() => { auth.authorizeStaffWithReason.mockReset(); });

  it("rechaza una autorización anticipada sin motivo suficiente", async () => {
    const { rpc } = staffFor({ status: "waiting", giftable_at: "2099-01-01T00:00:00.000Z" });
    const response = await PATCH(request({ status: "ready", notes: "corto" }), context);

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("registra el actor real y señala la autorización excepcional", async () => {
    const { rpc } = staffFor({ status: "manual_review", giftable_at: null });
    const response = await PATCH(request({ status: "ready", notes: "Autorizado por soporte" }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, override: true });
    expect(rpc).toHaveBeenCalledWith("review_game_id_validation", expect.objectContaining({
      p_actor_id: "00000000-0000-4000-8000-000000000001",
      p_note: "Autorizado por soporte",
    }));
  });

  it("responde conflicto al intentar autorizar un ID bloqueado", async () => {
    const { rpc } = staffFor({ status: "blocked", giftable_at: null });
    const response = await PATCH(request({ status: "ready", notes: "Autorizado por soporte" }), context);

    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("distingue un usuario autenticado sin rol", async () => {
    auth.authorizeStaffWithReason.mockResolvedValue({ ok: false, status: 403 });
    const response = await PATCH(request({ status: "waiting" }), context);

    expect(response.status).toBe(403);
  });
});
