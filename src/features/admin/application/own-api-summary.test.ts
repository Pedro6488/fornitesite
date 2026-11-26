import { describe, expect, it } from "vitest";
import { classifyOwnCall, mexicoDay, summarizeOwnApi, type OwnCallRow } from "./own-api-summary";

const call = (overrides: Partial<OwnCallRow>): OwnCallRow => ({
  created_at: "2026-11-26T18:00:00Z", action: "gift_check", code: "eligible_to_receive_gift", result: true,
  decision: null, duration_ms: 1000, error: null, http_status: 200, ...overrides,
});

describe("classifyOwnCall", () => {
  it("tells who answered each call", () => {
    expect(classifyOwnCall(call({}))).toBe("answered");
    expect(classifyOwnCall(call({ code: "receiver_account_not_found", result: false }))).toBe("answered");
    expect(classifyOwnCall(call({ decision: "shadow" }))).toBe("shadow");
    expect(classifyOwnCall(call({ decision: "fallback_to_fnshop", code: "epic_unavailable" }))).toBe("fallback");
    expect(classifyOwnCall(call({ code: null, error: "Tiempo de espera agotado.", http_status: null }))).toBe("failed");
    expect(classifyOwnCall(call({ http_status: 502 }))).toBe("failed");
  });
});

describe("summarizeOwnApi", () => {
  const now = new Date("2026-11-26T19:00:00Z");

  it("counts by Mexico day, leaves comparisons out of the share and computes latency per action", () => {
    const summary = summarizeOwnApi({
      now, days: 3,
      own: [
        call({ duration_ms: 4400, created_at: "2026-11-26T17:21:00Z" }),
        call({ duration_ms: 5100, created_at: "2026-11-26T18:27:00Z" }),
        call({ action: "friend_add", code: "friend_request_sent", duration_ms: 900, created_at: "2026-11-25T20:00:00Z" }),
        call({ decision: "shadow", created_at: "2026-11-25T20:00:00Z" }),
        call({ decision: "fallback_to_fnshop", code: "epic_unavailable", created_at: "2026-11-26T05:00:00Z" }), // 25 nov en México
      ],
      fnshop: [
        { created_at: "2026-11-26T18:00:00Z", action: "gift_send" },
        { created_at: "2026-11-25T18:00:00Z", action: "friend_add" },
        { created_at: "2026-11-26T18:00:00Z", action: "verify_license" },
      ],
    });
    expect(summary.totals).toMatchObject({ calls: 5, answered: 3, shadow: 1, fallback: 1, failed: 0, today: 2, lastCallAt: "2026-11-26T18:27:00Z" });
    expect(summary.share).toEqual({ own: 3, fnshop: 2, ownPercent: 60 });
    expect(summary.answerRate).toBe(75);
    expect(summary.byDay).toEqual([
      { day: "2026-11-24", own: 0, fnshop: 0, problems: 0 },
      { day: "2026-11-25", own: 1, fnshop: 1, problems: 1 },
      { day: "2026-11-26", own: 2, fnshop: 1, problems: 0 },
    ]);
    expect(summary.byAction[0]).toMatchObject({ action: "gift_check", calls: 4, answered: 2, p50: 1000, p95: 5100 });
    expect(summary.codes[0]).toEqual({ code: "eligible_to_receive_gift", calls: 3 });
  });

  it("has no rates before the first call", () => {
    const summary = summarizeOwnApi({ now, days: 7, own: [], fnshop: [] });
    expect(summary.share.ownPercent).toBeNull();
    expect(summary.answerRate).toBeNull();
    expect(summary.byDay).toHaveLength(7);
    expect(mexicoDay("2026-11-27T05:30:00Z")).toBe("2026-11-26");
  });
});
