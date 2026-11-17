// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { POST } from "./route";

const auth = vi.hoisted(() => ({ authorizeStaff: vi.fn() }));
vi.mock("@/shared/server/authorize-staff", () => auth);

async function request() {
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
  const form = new FormData();
  form.set("orderId", "00000000-0000-4000-8000-000000000001");
  form.set("image", new File([new Uint8Array(image)], "chat.png", { type: "image/png" }));
  return new Request("http://localhost/api/admin/references", { method: "POST", body: form });
}

function setup(status = "delivered", existing = false, insertError: unknown = null) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const from = vi.fn((table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "orders" ? { id: "order", status } : existing ? { id: "reference" } : null, error: null }) }) }),
    insert,
  }));
  auth.authorizeStaff.mockResolvedValue({ database: { from, storage: { from: () => ({ upload, remove }) } } });
  return { upload, remove, insert };
}

describe("publicar referencias desde admin", () => {
  beforeEach(() => vi.clearAllMocks());
  it("requiere acceso de administrador", async () => {
    auth.authorizeStaff.mockResolvedValue(null);
    expect((await POST(await request())).status).toBe(401);
  });
  it("rechaza pedidos que aún no se entregan", async () => {
    const { upload } = setup("paid");
    expect((await POST(await request())).status).toBe(409);
    expect(upload).not.toHaveBeenCalled();
  });
  it("evita duplicar referencias de un mismo pedido", async () => {
    const { upload } = setup("delivered", true);
    expect((await POST(await request())).status).toBe(409);
    expect(upload).not.toHaveBeenCalled();
  });
  it("guarda capturas sin comentario en la fuente pública compartida", async () => {
    const { insert } = setup();
    expect((await POST(await request())).status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ comment: null, image_mime_type: "image/webp", image_storage_path: expect.stringContaining("delivery-feedback/") }));
  });
  it("elimina el archivo si falla el registro, incluso por duplicado concurrente", async () => {
    const { remove } = setup("delivered", false, { code: "23505" });
    expect((await POST(await request())).status).toBe(409);
    expect(remove).toHaveBeenCalledWith([expect.stringContaining(".webp")]);
  });
});
