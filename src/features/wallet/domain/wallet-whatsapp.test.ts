import { describe, expect, it } from "vitest";
import { toCustomer, toStore, trackingUrl, whatsappLink, whatsappNumber } from "./wallet-whatsapp";

describe("avisos de pavos por WhatsApp", () => {
  it("agrega la lada del país a números de 10 dígitos y respeta los que ya la traen", () => {
    expect(whatsappNumber("55 1234 5678")).toBe("525512345678");
    expect(whatsappNumber("5512345678", "us")).toBe("15512345678");
    expect(whatsappNumber("525512345678")).toBe("525512345678");
    expect(whatsappNumber("5215619857749")).toBe("5215619857749");
    expect(whatsappNumber("123")).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
  });

  it("arma el enlace wa.me con el mensaje codificado", () => {
    const href = whatsappLink("5512345678", "Hola & adiós");
    expect(href).toBe("https://wa.me/525512345678?text=Hola%20%26%20adi%C3%B3s");
    expect(whatsappLink(undefined, "Hola")).toBeNull();
  });

  it("el aviso de devolución lista los objetos, los pavos devueltos y el seguimiento", () => {
    const url = trackingUrl("https://tienda.example", { id: "abcdef12-3456", public_token: "tok" });
    const text = toCustomer.refunded({ orderId: "abcdef12-3456", items: ["Emote Baile"], vbucks: 300, url });
    expect(text).toContain("#ABCDEF12");
    expect(text).toContain("• Emote Baile");
    expect(text).toContain("300 pavos");
    expect(text).toContain("https://tienda.example/pedidos/abcdef12-3456?access=tok");
  });

  it("los avisos de recarga llevan la referencia y, al rechazar, el motivo", () => {
    expect(toCustomer.topupApproved({ reference: "RECARGA-1A2B3C4D", vbucks: 5000, balance: 5250, appUrl: "https://t.example" })).toMatch(/RECARGA-1A2B3C4D[\s\S]*5,250 pavos/);
    expect(toCustomer.topupRejected({ reference: "RECARGA-1A2B3C4D", vbucks: 5000, reason: "El importe no coincide" })).toContain("El importe no coincide");
    expect(toStore.topupExpired({ reference: "RECARGA-1A2B3C4D", vbucks: 1000 })).toContain("RECARGA-1A2B3C4D");
  });
});
