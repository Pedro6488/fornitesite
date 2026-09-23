import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMercadoPagoSignature } from "./mercado-pago-webhook";

describe("verifyMercadoPagoSignature", () => {
  it("acepta una firma HMAC válida", () => {
    const secret = "test-secret"; const dataId = "ABC123"; const requestId = "request-1"; const ts = "123456";
    const digest = createHmac("sha256", secret).update(`id:abc123;request-id:${requestId};ts:${ts};`).digest("hex");
    expect(verifyMercadoPagoSignature({ signature: `ts=${ts},v1=${digest}`, requestId, dataId, secret })).toBe(true);
  });
  it("rechaza firmas modificadas", () => expect(verifyMercadoPagoSignature({ signature: `ts=1,v1=${"00".repeat(32)}`, requestId: "r", dataId: "id", secret: "secret" })).toBe(false));
});
