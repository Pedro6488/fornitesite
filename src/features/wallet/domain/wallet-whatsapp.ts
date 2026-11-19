/**
 * Avisos de pavos por WhatsApp. La tienda no tiene correo: el admin avisa al cliente y el cliente
 * escribe a la tienda con un botón que abre WhatsApp con el mensaje ya escrito (wa.me).
 */
export type WhatsappRegion = "mx" | "us";

/** Número para wa.me: solo dígitos; a 10 dígitos le falta la lada del país (52 México, 1 USA). */
export function whatsappNumber(phone: string | null | undefined, region: WhatsappRegion = "mx"): string | null {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length < 8) return null;
  return digits.length === 10 ? `${region === "us" ? "1" : "52"}${digits}` : digits;
}

export function whatsappLink(phone: string | null | undefined, text: string, region: WhatsappRegion = "mx"): string | null {
  const number = whatsappNumber(phone, region);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

const pavos = (n: number) => `${n.toLocaleString("es-MX")} pavos`;
const bullets = (items: readonly string[]) => items.map((item) => `• ${item}`).join("\n");
export const orderNumber = (orderId: string) => orderId.slice(0, 8).toUpperCase();
export function trackingUrl(appUrl: string, order: { id: string; public_token?: string | null }) {
  return `${appUrl}/pedidos/${order.id}${order.public_token ? `?access=${order.public_token}` : ""}`;
}

/** Mensajes que el admin manda al cliente. */
export const toCustomer = {
  topupApproved: (input: { reference: string; vbucks: number; bonus?: number; balance: number; appUrl: string }) =>
    `Hola, ya acreditamos tu recarga ${input.reference}: +${pavos(input.vbucks)}${input.bonus ? ` y +${pavos(input.bonus)} de regalo` : ""}.\nTu saldo es de ${pavos(input.balance)}.\n\nÚsalos en ${input.appUrl}/pavos. Al pagar con pavos, el envío a tu ID de Fortnite es automático.`,
  topupRejected: (input: { reference: string; vbucks: number; reason: string }) =>
    `Hola, revisamos tu recarga ${input.reference} de ${pavos(input.vbucks)} y no pudimos confirmar el pago.\nMotivo: ${input.reason}\n\nNo se agregó saldo. Si ya pagaste, respóndenos con tu comprobante y lo revisamos.`,
  delivered: (input: { orderId: string; items: readonly string[]; displayName: string; url: string }) =>
    `Hola, tu pedido #${orderNumber(input.orderId)} pagado con pavos ya se envió a ${input.displayName}:\n${bullets(input.items)}\n\nRevisa tus regalos en Fortnite. Seguimiento: ${input.url}`,
  refunded: (input: { orderId: string; items: readonly string[]; vbucks: number; url: string }) =>
    `Hola, no pudimos enviar ${input.items.length === 1 ? "este objeto" : "estos objetos"} de tu pedido #${orderNumber(input.orderId)}:\n${bullets(input.items)}\n\nTe devolvimos ${pavos(input.vbucks)} a tu saldo; puedes usarlos en tu próxima compra. Detalle: ${input.url}`,
  /** Para listas de difusión de WhatsApp Business: se copia y se pega. */
  campaign: (input: { label: string; minVbucks: number; bonusBp: number; cap: number | null; endsAt: string; firstTopupOnly: boolean; appUrl: string }) =>
    `🎁 ${input.label} en SigfriedLootBox\nRecarga desde ${pavos(input.minVbucks)} y recibe +${(input.bonusBp / 100).toLocaleString("es-MX")}% de pavos de regalo${input.cap ? ` (hasta ${pavos(input.cap)})` : ""}${input.firstTopupOnly ? " en tu primera recarga" : ""}.\nVálido hasta el ${new Date(input.endsAt).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}.\n\nCompra tus pavos aquí: ${input.appUrl}/pavos\nAl pagar con pavos, el envío a tu ID de Fortnite es automático.`,
  frozen: (input: { reason: string }) =>
    `Hola, pausamos por seguridad el uso de tu saldo de pavos (${input.reason}). Tu saldo se conserva. Respóndenos por este medio para resolverlo.`,
};

/** Mensajes que el cliente manda a la tienda. */
export const toStore = {
  topupRejected: (input: { reference: string; vbucks: number }) =>
    `Hola, mi recarga ${input.reference} de ${pavos(input.vbucks)} fue rechazada y quiero revisarla. Te envío mi comprobante.`,
  topupExpired: (input: { reference: string; vbucks: number }) =>
    `Hola, pagué la recarga ${input.reference} de ${pavos(input.vbucks)}, pero venció antes de subir el comprobante. Te lo envío por aquí.`,
  frozen: () => "Hola, mi saldo de pavos aparece en revisión y quiero resolverlo.",
  refunded: (input: { orderId: string; vbucks: number; url: string }) =>
    `Hola, en mi pedido #${orderNumber(input.orderId)} me devolvieron ${pavos(input.vbucks)}. Quiero ayuda con los objetos que no se enviaron. Seguimiento: ${input.url}`,
};
