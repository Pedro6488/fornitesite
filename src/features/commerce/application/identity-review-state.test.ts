import { describe, expect, it } from "vitest";
import { isIdentityReviewPending, nextManualValidationStatus } from "./identity-review-state";

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
});
