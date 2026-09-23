import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMercadoPagoSignature(input: {
  signature: string | null;
  requestId: string | null;
  dataId: string;
  secret: string;
}): boolean {
  if (!input.signature || !input.requestId || !input.dataId || !input.secret) return false;
  const parts = Object.fromEntries(input.signature.split(",").map((part) => part.trim().split("=", 2)));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex"); const receivedBuffer = Buffer.from(parts.v1, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
