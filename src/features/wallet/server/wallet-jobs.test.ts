import { beforeEach, describe, expect, it, vi } from "vitest";
import { WALLET_MAX_ATTEMPTS, runWalletJob, runWalletJobs } from "./wallet-jobs";

const mocks = vi.hoisted(() => ({ deliver: vi.fn(), retry: vi.fn(), alert: vi.fn() }));
vi.mock("@/features/notifications/server/providers", () => ({ deliverOutboxJob: mocks.deliver }));
vi.mock("@/features/notifications/server/outbox", () => ({ retryOutboxJob: mocks.retry }));
vi.mock("@/features/fnshop/server/get-fnshop-client", () => ({ sendOperationsAlert: mocks.alert }));

type Job = { id: string; job_type: string; aggregate_id: string; payload: Record<string, unknown>; attempts: number };
function database(queue: Job[]) {
  const updates: Record<string, unknown>[] = [];
  const rpc = vi.fn(async () => ({ data: queue.length ? [queue.shift()] : [], error: null }));
  const from = vi.fn(() => ({ update: (values: Record<string, unknown>) => ({ eq: async () => { updates.push(values); return { error: null }; } }) }));
  return { client: { rpc, from } as never, updates, rpc };
}
const job = (attempts = 1, id = "job-1"): Job => ({ id, job_type: "wallet.deliver", aggregate_id: "11111111-2222", payload: {}, attempts });

describe("cola de entregas con pavos", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.deliver.mockResolvedValue(undefined); });

  it("procesa varios trabajos por llamada y se detiene cuando la cola queda vacía", async () => {
    const db = database([job(1, "a"), job(1, "b"), job(1, "c")]);
    expect(await runWalletJobs(db.client)).toEqual({ processed: 3, retried: 0, failed: 0 });
    expect(db.rpc).toHaveBeenCalledTimes(4);
  });

  it("respeta el máximo de trabajos y el presupuesto de tiempo", async () => {
    const many = database(Array.from({ length: 20 }, (_, index) => job(1, `j${index}`)));
    expect((await runWalletJobs(many.client, { maxJobs: 5 })).processed).toBe(5);
    let clock = 0;
    const slow = database([job(1, "a"), job(1, "b"), job(1, "c")]);
    mocks.deliver.mockImplementation(async () => { clock += 30_000; });
    expect((await runWalletJobs(slow.client, { budgetMs: 45_000, now: () => clock })).processed).toBe(2);
  });

  it("reprograma un fallo mientras queden intentos", async () => {
    mocks.deliver.mockRejectedValue(new Error("Envío en curso"));
    const db = database([job(3)]);
    expect(await runWalletJob(db.client)).toBe("retry");
    expect(mocks.retry).toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it("al agotar los intentos marca el trabajo como fallido y avisa una sola vez por pedido", async () => {
    mocks.deliver.mockRejectedValue(new Error("Hay envíos pendientes de conciliación."));
    const db = database([job(WALLET_MAX_ATTEMPTS)]);
    expect(await runWalletJob(db.client)).toBe("failed");
    expect(mocks.retry).not.toHaveBeenCalled();
    expect(db.updates[0]).toMatchObject({ status: "failed", last_error: "Hay envíos pendientes de conciliación." });
    expect(mocks.alert).toHaveBeenCalledWith(db.client, expect.stringContaining("#11111111"), "wallet:failed:11111111-2222", "/admin/pedidos/11111111-2222");
  });

  it("corta un trabajo que se interrumpió demasiadas veces sin volver a enviarlo", async () => {
    const db = database([job(WALLET_MAX_ATTEMPTS + 1)]);
    expect(await runWalletJob(db.client)).toBe("failed");
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(db.updates[0]).toMatchObject({ status: "failed" });
  });
});
