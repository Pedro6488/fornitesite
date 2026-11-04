import { describe, expect, it } from "vitest";
import { getRankingMonth } from "./ranking-month";

describe("ranking month in Mexico City", () => {
  it("keeps deliveries before local midnight in the previous month", () => {
    expect(getRankingMonth(new Date("2027-01-01T05:59:59Z"))).toMatchObject({
      start: "2026-12-01T06:00:00.000Z", end: "2027-01-01T06:00:00.000Z",
    });
  });
  it("changes period at local midnight, including year rollover", () => {
    expect(getRankingMonth(new Date("2027-01-01T06:00:00Z"))).toMatchObject({
      start: "2027-01-01T06:00:00.000Z", end: "2027-02-01T06:00:00.000Z",
    });
  });
});
