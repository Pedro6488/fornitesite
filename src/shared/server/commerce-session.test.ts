import { describe, expect, it } from "vitest";
import { chooseCanonicalCommerceSessionId, chooseMergedActiveValidationId } from "./commerce-session";

describe("chooseCanonicalCommerceSessionId", () => {
  it("elige la misma sesión sin importar el orden de solicitudes concurrentes", () => {
    expect(chooseCanonicalCommerceSessionId(["b-session", "a-session"])).toBe("a-session");
    expect(chooseCanonicalCommerceSessionId(["a-session", "b-session"])).toBe("a-session");
  });
});

describe("chooseMergedActiveValidationId", () => {
  const candidates = [
    { id: "validation-a", epic_account_id: "epic-a", last_checked_at: "2026-10-18T10:00:00.000Z" },
    { id: "validation-b", epic_account_id: "epic-b", last_checked_at: "2026-10-18T09:00:00.000Z" },
  ];

  it("conserva el ID activo de la sesión que inició el login", () => {
    expect(chooseMergedActiveValidationId(candidates, ["epic-b", "epic-a"])).toBe("validation-b");
  });

  it("usa el ID activo previo de la cuenta si el actual no existe", () => {
    expect(chooseMergedActiveValidationId(candidates, ["missing", "epic-a"])).toBe("validation-a");
  });

  it("usa el ID más reciente únicamente como último fallback", () => {
    expect(chooseMergedActiveValidationId(candidates, [])).toBe("validation-a");
  });
});
