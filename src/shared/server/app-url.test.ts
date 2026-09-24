import { describe, expect, it } from "vitest";
import { DEFAULT_APP_URL, getAppUrl } from "./app-url";

describe("getAppUrl", () => {
  it("usa el dominio de producción cuando no existe una variable", () => {
    expect(getAppUrl(undefined)).toBe(DEFAULT_APP_URL);
  });

  it("elimina la diagonal final para construir rutas seguras", () => {
    expect(getAppUrl("https://example.com///")).toBe("https://example.com");
  });
});
