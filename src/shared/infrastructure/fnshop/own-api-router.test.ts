import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FnShopAction } from "./fnshop-budget";
import { fnShopConfigFromEnv, type FnShopCaller, type FnShopResponse } from "./fnshop-client";
import { OwnApiFirstCaller, ownApiConfigFromEnv, type OwnApiConfig } from "./own-api-router";

const prodConfig = fnShopConfigFromEnv({ VERCEL_ENV: "production", FNSHOP_API_KEY: "fn-key" });
const ownEnv = { OWN_API_BASE_URL: "https://api.sigfriedlootbox.com/api/v3/service/", OWN_API_KEY: "egk_live_abcdefgh_" + "x".repeat(32) };
const own = ownApiConfigFromEnv(ownEnv, prodConfig) as OwnApiConfig;

function fakeDatabase() {
  const inserted: Record<string, unknown>[] = [];
  const database = {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return { select: () => ({ single: async () => ({ data: { id: 1000 + inserted.length }, error: null }) }) };
      },
    }),
  };
  return { database: database as unknown as SupabaseClient, inserted };
}

function fakeFnShop(body: Record<string, unknown> = { result: true, code: "from_fnshop" }) {
  const calls: FnShopAction[] = [];
  const caller: FnShopCaller = {
    config: prodConfig,
    call: vi.fn(async (action: FnShopAction): Promise<FnShopResponse> => {
      calls.push(action);
      return { body, result: body.result as boolean, code: body.code as string, httpStatus: 200, callId: 1, simulated: false };
    }),
    decide: vi.fn(async () => undefined),
    usage: vi.fn(async () => ({ used: 0, today: 0 })),
  };
  return { caller, calls };
}

function jsonFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

describe("own API configuration", () => {
  it("is off outside production, with the simulator, or without URL and key", () => {
    expect(ownApiConfigFromEnv(ownEnv, fnShopConfigFromEnv({ VERCEL_ENV: "preview", FNSHOP_SIMULATE: "true" }))).toBeNull();
    expect(ownApiConfigFromEnv(ownEnv, fnShopConfigFromEnv({ VERCEL_ENV: "preview", FNSHOP_API_KEY: "k" }))).toBeNull();
    expect(ownApiConfigFromEnv({ OWN_API_BASE_URL: ownEnv.OWN_API_BASE_URL }, prodConfig)).toBeNull();
  });

  it("defaults to friend_add/friend_status first and gift_check in shadow, and never routes gift_send first", () => {
    expect(own).toMatchObject({ baseUrl: "https://api.sigfriedlootbox.com/api/v3/service", primary: ["friend_add", "friend_status"], shadow: ["gift_check"] });
    expect(ownApiConfigFromEnv({ ...ownEnv, OWN_API_PRIMARY: "friend_add,gift_send,order_history" }, prodConfig)?.primary).toEqual(["friend_add"]);
  });
});

describe("OwnApiFirstCaller", () => {
  it("answers friend_add from our API and logs it as provider own without touching FN Shop", async () => {
    const { database, inserted } = fakeDatabase();
    const fnshop = fakeFnShop();
    const fetchMock = jsonFetch({ result: true, code: "friend_request_sent", receiver_id: "a".repeat(32), sent: 4 });
    const router = new OwnApiFirstCaller(database, fnshop.caller, own, { fetch: fetchMock as unknown as typeof fetch });

    const response = await router.call("friend_add", { receiver: "psn:Jugador" }, { trigger: "customer", validationId: "v1" });

    expect(response).toMatchObject({ code: "friend_request_sent", callId: 1001, simulated: false });
    expect(fnshop.calls).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.sigfriedlootbox.com/api/v3/service/friend_add");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe(ownEnv.OWN_API_KEY);
    expect(String(init.body)).toBe("svr=www.sigfriedlootbox.com&receiver=psn%3AJugador");
    expect(inserted[0]).toMatchObject({ provider: "own", action: "friend_add", counted: false, decision: null, validation_id: "v1" });
    expect(JSON.stringify(inserted[0])).not.toContain(ownEnv.OWN_API_KEY);
  });

  it("keeps a definitive answer from our API (receiver not found) instead of asking FN Shop", async () => {
    const { database } = fakeDatabase();
    const fnshop = fakeFnShop();
    const router = new OwnApiFirstCaller(database, fnshop.caller, own, { fetch: jsonFetch({ result: false, code: "receiver_account_not_found" }) as unknown as typeof fetch });
    expect((await router.call("friend_add", { receiver: "psn:X" }, { trigger: "customer" })).code).toBe("receiver_account_not_found");
    expect(fnshop.calls).toEqual([]);
  });

  it.each([
    ["no sender accounts", jsonFetch({ result: false, code: "no_sender_accounts" })],
    ["Epic down", jsonFetch({ result: false, code: "epic_unavailable" })],
    ["HTTP 502 from Caddy", jsonFetch({ error: "bad gateway" }, 502)],
    ["network error", vi.fn(async () => { throw new Error("ECONNREFUSED"); })],
    ["non-JSON answer", vi.fn(async () => new Response("<html>", { status: 200 }))],
  ])("falls back to FN Shop on %s and records the fallback", async (_label, fetchMock) => {
    const { database, inserted } = fakeDatabase();
    const fnshop = fakeFnShop({ result: true, code: "friend_status" });
    const router = new OwnApiFirstCaller(database, fnshop.caller, own, { fetch: fetchMock as unknown as typeof fetch });
    const response = await router.call("friend_status", { receiver: "Jugador" }, { trigger: "customer" });
    expect(response.code).toBe("friend_status");
    expect(fnshop.calls).toEqual(["friend_status"]);
    expect(inserted[0]).toMatchObject({ provider: "own", decision: "fallback_to_fnshop" });
  });

  it("lets FN Shop decide gift_check while our API answers in parallel for comparison", async () => {
    const { database, inserted } = fakeDatabase();
    const fnshop = fakeFnShop({ result: true, code: "eligible_to_receive_gift", sender_id: "fn" });
    const fetchMock = jsonFetch({ result: false, code: "not_eligible_to_receive_gift" });
    const router = new OwnApiFirstCaller(database, fnshop.caller, own, { fetch: fetchMock as unknown as typeof fetch });
    const response = await router.call("gift_check", { offerId: "v2:/x", receiver: "Jugador" }, { trigger: "admin", orderId: "o1" });
    expect(response.code).toBe("eligible_to_receive_gift");
    expect(fnshop.calls).toEqual(["gift_check"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(inserted[0]).toMatchObject({ provider: "own", action: "gift_check", decision: "shadow", code: "not_eligible_to_receive_gift", order_id: "o1" });
  });

  it("never sends gift_send to our API", async () => {
    const { database } = fakeDatabase();
    const fnshop = fakeFnShop({ result: true, code: "gift_sent_successfully" });
    const fetchMock = jsonFetch({});
    const router = new OwnApiFirstCaller(database, fnshop.caller, own, { fetch: fetchMock as unknown as typeof fetch });
    await router.call("gift_send", { offerId: "v2:/x", receiver: "Jugador", order_id: "i1" }, { trigger: "admin" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fnshop.calls).toEqual(["gift_send"]);
  });

  it("a failing shadow call never breaks the FN Shop answer", async () => {
    const { database } = fakeDatabase();
    const fnshop = fakeFnShop({ result: true, code: "eligible_to_receive_gift" });
    const router = new OwnApiFirstCaller(database, fnshop.caller, own, { fetch: vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch });
    expect((await router.call("gift_check", { offerId: "v2:/x", receiver: "J" }, { trigger: "admin" })).code).toBe("eligible_to_receive_gift");
  });
});
