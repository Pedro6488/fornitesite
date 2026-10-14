import { describe, expect, it } from "vitest";
import { chooseCanonicalCommerceSessionId } from "./commerce-session";

describe("chooseCanonicalCommerceSessionId", () => {
  it("elige la misma sesión sin importar el orden de solicitudes concurrentes", () => {
    expect(chooseCanonicalCommerceSessionId(["b-session", "a-session"])).toBe("a-session");
    expect(chooseCanonicalCommerceSessionId(["a-session", "b-session"])).toBe("a-session");
  });
});
