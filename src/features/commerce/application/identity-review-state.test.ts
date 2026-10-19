import { describe, expect, it } from "vitest";
import { groupReviewsByRecipient, inheritManualValidation, isIdentityReviewPending, nextManualValidationStatus } from "./identity-review-state";

describe("identity review state", () => {
  it("solo deja estados accionables en la cola de revisión", () => {
    expect(isIdentityReviewPending("manual_review")).toBe(true);
    expect(isIdentityReviewPending("waiting")).toBe(true);
    expect(isIdentityReviewPending("pending_friendship")).toBe(true);
    expect(isIdentityReviewPending("ready")).toBe(false);
    expect(isIdentityReviewPending("blocked")).toBe(false);
  });

  it("no revierte un bloqueo cuando el cliente revalida el mismo ID", () => {
    expect(nextManualValidationStatus("blocked")).toBe("blocked");
    expect(nextManualValidationStatus("ready")).toBe("ready");
    expect(nextManualValidationStatus("waiting")).toBe("waiting");
    expect(nextManualValidationStatus("manual_review")).toBe("manual_review");
  });

  it("hereda la decisión de un gamertag revisado en otra sesión", () => {
    expect(inheritManualValidation([])).toEqual({ status: "manual_review", giftable_at: null });
    expect(inheritManualValidation([{ status: "manual_review", giftable_at: null }, { status: "ready", giftable_at: null }]))
      .toEqual({ status: "ready", giftable_at: null });
    expect(inheritManualValidation([{ status: "ready", giftable_at: null }, { status: "blocked", giftable_at: null }]))
      .toEqual({ status: "blocked", giftable_at: null });
  });

  it("no reinicia la espera de 48 horas al registrar el gamertag de nuevo", () => {
    expect(inheritManualValidation([
      { status: "waiting", giftable_at: "2026-10-20T10:00:00.000Z" },
      { status: "waiting", giftable_at: "2026-10-19T10:00:00.000Z" },
    ])).toEqual({ status: "waiting", giftable_at: "2026-10-19T10:00:00.000Z" });
  });

  it("muestra una sola tarjeta por gamertag con todos sus pedidos", () => {
    const grouped = groupReviewsByRecipient([
      { id: "old", epic_account_id: "manual:a", status: "ready" as const, last_checked_at: "2026-10-18T17:21:00.000Z", orders: ["order-1"] },
      { id: "new", epic_account_id: "manual:a", status: "manual_review" as const, last_checked_at: "2026-10-18T18:29:00.000Z", orders: [] },
      { id: "other", epic_account_id: "manual:b", status: "waiting" as const, last_checked_at: "2026-10-18T12:00:00.000Z", orders: [] },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ id: "old", status: "ready", orders: ["order-1"], session_count: 2 });
    expect(grouped[1]).toMatchObject({ id: "other", session_count: 1 });
  });
});
