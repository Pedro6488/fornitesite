import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { budgetDecision, crossedThresholds } from "./fnshop-budget";
import { FnShopClient, FnShopTransportError, FnShopUnavailableError, fnShopConfigFromEnv, type FnShopConfig } from "./fnshop-client";
import { simulateFnShop } from "./fnshop-simulator";

const limits = { monthlyLimit: 5000, dailyLimit: 300 };

describe("FN Shop budget guard", () => {
  it("lets everything through below 85 %", () => {
    expect(budgetDecision("friend_add", { used: 3400, today: 10 }, limits).allowed).toBe(true);
    expect(budgetDecision("friend_add", { used: 3500, today: 10 }, limits).level).toBe("warning");
  });
  it("sends new IDs to manual review from 85 %", () => {
    expect(budgetDecision("friend_add", { used: 4250, today: 10 }, limits).allowed).toBe(false);
    expect(budgetDecision("friend_status", { used: 4250, today: 10 }, limits).allowed).toBe(true);
    expect(budgetDecision("gift_send", { used: 4250, today: 10 }, limits).allowed).toBe(true);
  });
  it("keeps only delivery and reconciliation from 95 % or over the daily cap", () => {
    for (const usage of [{ used: 4750, today: 10 }, { used: 100, today: 300 }]) {
      expect(budgetDecision("friend_status", usage, limits).allowed).toBe(false);
      expect(budgetDecision("shop", usage, limits).allowed).toBe(false);
      expect(budgetDecision("gift_check", usage, limits).allowed).toBe(true);
      expect(budgetDecision("gift_send", usage, limits).allowed).toBe(true);
      expect(budgetDecision("order_history", usage, limits).allowed).toBe(true);
    }
  });
  it("stops everything but verify_license when the term is used up", () => {
    expect(budgetDecision("gift_send", { used: 5000, today: 0 }, limits).allowed).toBe(false);
    expect(budgetDecision("verify_license", { used: 5000, today: 0 }, limits).allowed).toBe(true);
  });
  it("reports each threshold once, when a call crosses it", () => {
    expect(crossedThresholds(3499, 3500, 5000)).toEqual([70]);
    expect(crossedThresholds(3500, 3501, 5000)).toEqual([]);
    expect(crossedThresholds(4999, 5000, 5000)).toEqual([100]);
  });
});

describe("FN Shop configuration", () => {
  it("only allows live calls in the Vercel production environment", () => {
    expect(fnShopConfigFromEnv({ VERCEL_ENV: "production", FNSHOP_API_KEY: "k" }).liveAllowed).toBe(true);
    expect(fnShopConfigFromEnv({ VERCEL_ENV: "preview", FNSHOP_API_KEY: "k" }).liveAllowed).toBe(false);
    expect(fnShopConfigFromEnv({ NODE_ENV: "production", FNSHOP_API_KEY: "k" }).liveAllowed).toBe(false);
  });
  it("never simulates in production even if the flag is left on", () => {
    expect(fnShopConfigFromEnv({ VERCEL_ENV: "production", FNSHOP_SIMULATE: "true" }).simulate).toBe(false);
    expect(fnShopConfigFromEnv({ VERCEL_ENV: "preview", FNSHOP_SIMULATE: "true" }).simulate).toBe(true);
  });
});

type Inserted = Record<string, unknown>;

function fakeDatabase(usage = { counted_total: 0, counted_today: 0 }) {
  const inserted: Inserted[] = [];
  const decisions: { id: unknown; decision: unknown }[] = [];
  const database = {
    rpc: vi.fn(async () => ({ data: [usage], error: null })),
    from: () => ({
      insert: (row: Inserted) => {
        inserted.push(row);
        return { select: () => ({ single: async () => ({ data: { id: inserted.length }, error: null }) }) };
      },
      update: (values: { decision: unknown }) => ({ eq: (_column: string, id: unknown) => ({ is: async () => { decisions.push({ id, decision: values.decision }); return { error: null }; } }) }),
    }),
  };
  return { database: database as unknown as SupabaseClient, inserted, decisions };
}

const liveConfig: FnShopConfig = {
  ...fnShopConfigFromEnv({ VERCEL_ENV: "production", FNSHOP_API_KEY: "secret-key", FNSHOP_TERM_STARTS_AT: "2026-11-12" }),
};

describe("FnShopClient", () => {
  it("posts form-encoded parameters with the key in a header and logs the call without the key", async () => {
    const { database, inserted } = fakeDatabase();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ result: true, code: "friend_request_sent", receiver_id: "a".repeat(32) }), { status: 200, headers: { "content-type": "application/json", "set-cookie": "x=1" } }));
    const client = new FnShopClient(database, liveConfig, { fetch: fetchMock as unknown as typeof fetch });

    const response = await client.call("friend_add", { receiver: "psn:Jugador" }, { trigger: "customer", validationId: "v1" });

    expect(response.code).toBe("friend_request_sent");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://fnitem.shop/api/v3/service/friend_add");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("secret-key");
    expect(init.body).toBe("receiver=psn%3AJugador");
    expect(inserted[0]).toMatchObject({ action: "friend_add", counted: true, simulated: false, code: "friend_request_sent", validation_id: "v1", trigger: "customer" });
    expect(JSON.stringify(inserted[0])).not.toContain("secret-key");
    expect(inserted[0].response_headers).not.toHaveProperty("set-cookie");
  });

  it("refuses to call the real API outside production", async () => {
    const { database } = fakeDatabase();
    const fetchMock = vi.fn();
    const client = new FnShopClient(database, fnShopConfigFromEnv({ VERCEL_ENV: "preview", FNSHOP_API_KEY: "k" }), { fetch: fetchMock as unknown as typeof fetch });
    await expect(client.call("friend_add", { receiver: "x" }, { trigger: "customer" })).rejects.toBeInstanceOf(FnShopUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers from the simulator in QA and does not count the call", async () => {
    const { database, inserted } = fakeDatabase();
    const fetchMock = vi.fn();
    const client = new FnShopClient(database, fnShopConfigFromEnv({ VERCEL_ENV: "preview", FNSHOP_SIMULATE: "true" }), { fetch: fetchMock as unknown as typeof fetch });
    const response = await client.call("gift_send", { receiver: "Jugador", offerId: "o", order_id: "i1" }, { trigger: "admin" });
    expect(response.code).toBe("gift_sent_successfully");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(inserted[0]).toMatchObject({ simulated: true, counted: false });
  });

  it("blocks the call before sending when the budget says no", async () => {
    const { database, inserted } = fakeDatabase({ counted_total: 4800, counted_today: 0 });
    const fetchMock = vi.fn();
    const alert = vi.fn(async () => undefined);
    const client = new FnShopClient(database, liveConfig, { fetch: fetchMock as unknown as typeof fetch, alert });
    await expect(client.call("friend_status", { receiver: "x" }, { trigger: "customer" })).rejects.toMatchObject({ reason: "budget" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
    expect(alert).toHaveBeenCalledOnce();
  });

  it("logs and throws a transport error when the answer is not JSON, counting it to stay safe", async () => {
    const { database, inserted } = fakeDatabase();
    const fetchMock = vi.fn(async () => new Response("<html>502</html>", { status: 502 }));
    const client = new FnShopClient(database, liveConfig, { fetch: fetchMock as unknown as typeof fetch });
    const error = await client.call("gift_send", { receiver: "x", offerId: "o" }, { trigger: "admin" }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(FnShopTransportError);
    expect((error as FnShopTransportError).callId).toBe(1);
    expect(inserted[0]).toMatchObject({ counted: true, http_status: 502, response_body: null });
  });

  it("does not count verify_license nor plan_limit_reached", async () => {
    const { database, inserted } = fakeDatabase();
    const responses = [{ result: true, user_id: 1, plan: "basic" }, { result: false, code: "plan_limit_reached", used: 5000 }];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(responses.shift())));
    const client = new FnShopClient(database, liveConfig, { fetch: fetchMock as unknown as typeof fetch, alert: async () => undefined });
    await client.call("verify_license", {}, { trigger: "admin" });
    await client.call("gift_check", { receiver: "x", offerId: "o" }, { trigger: "admin" });
    expect(inserted.map((row) => row.counted)).toEqual([false, false]);
  });

  it("alerts once when a call crosses 70 % of the term", async () => {
    const { database } = fakeDatabase({ counted_total: 3499, counted_today: 0 });
    const alert = vi.fn(async () => undefined);
    const client = new FnShopClient(database, liveConfig, { fetch: (async () => new Response(JSON.stringify({ result: true, code: "eligible_to_receive_gift" }))) as unknown as typeof fetch, alert });
    await client.call("gift_check", { receiver: "x", offerId: "o" }, { trigger: "admin" });
    expect(alert).toHaveBeenCalledWith(expect.stringContaining("70 %"), expect.stringContaining("fnshop:quota:70"));
  });

  it("records the decision once", async () => {
    const { database, decisions } = fakeDatabase();
    const client = new FnShopClient(database, liveConfig);
    await client.decide(7, "ready");
    await client.decide(null, "ignored");
    expect(decisions).toEqual([{ id: 7, decision: "ready" }]);
  });
});

describe("FN Shop simulator", () => {
  it("follows the documented shapes for the main scenarios", () => {
    expect(simulateFnShop("friend_add", { receiver: "Jugador" })).toMatchObject({ code: "friend_request_sent", can_gift_now: false, giftable_at: null });
    expect(simulateFnShop("friend_add", { receiver: "noexiste" })).toMatchObject({ result: false, code: "receiver_account_not_found" });
    expect(simulateFnShop("friend_add", { receiver: "listo" })).toMatchObject({ code: "already_friends", can_gift_now: true });
    expect(simulateFnShop("gift_send", { receiver: "dudoso" })).toMatchObject({ code: "gift_outcome_unknown", outcome: "unknown" });
    expect(String((simulateFnShop("friend_add", { receiver: "Jugador" }) as { receiver_id: string }).receiver_id)).toMatch(/^[0-9a-f]{32}$/);
  });
});
