/**
 * Cómo se leen `gift_check` y `gift_send`. Un code desconocido nunca cuenta como éxito.
 */
export type GiftCheckResult =
  | { eligible: true; senderId: string | null; finalPrice: number | null }
  | { eligible: false; code: string; message: string; giftableAt: string | null; reasons: readonly string[] };

export type GiftSendResult =
  | { outcome: "sent"; trackId: string | null; senderId: string | null; senderName: string | null; finalPrice: number | null }
  | { outcome: "unknown"; code: string; message: string; senderId: string | null; senderName: string | null }
  | { outcome: "refused"; code: string; message: string; reasons: readonly string[] };

const REASON_MESSAGES: Record<string, string> = {
  friendship_not_found: "El cliente no es amigo de ninguna cuenta remitente.",
  friendship_not_passed: "La amistad todavía no cumple las 48 horas.",
  vbucks: "Ninguna cuenta remitente tiene paVos suficientes.",
  gifts: "Las cuentas remitentes ya usaron sus regalos del día.",
  token_expired: "Una cuenta remitente perdió su sesión; reconéctala en FN Shop.",
  throttled: "Epic está limitando las cuentas remitentes; intenta en unos minutos.",
  other: "FN Shop no dio el motivo.",
};

const CODE_MESSAGES: Record<string, string> = {
  receiver_account_not_found: "La cuenta del destinatario no existe en Epic.",
  catalog_out_of_date: "El objeto cambió en la tienda de Fortnite (offerId vencido).",
  purchase_not_allowed: "Epic no permite regalar este objeto.",
  receiver_owns_item_from_bundle: "El destinatario ya tiene un objeto de este lote.",
  receiver_will_not_accept_gifts: "El destinatario tiene desactivados los regalos.",
  final_price_not_match: "El precio en Fortnite cambió.",
  invalid_sender_account: "La cuenta remitente indicada no es válida; revisa las cuentas en FN Shop.",
  account_not_in_group: "La cuenta remitente no está en la categoría; revisa las cuentas en FN Shop.",
  no_accounts_in_group: "No hay cuentas remitentes en la categoría; revisa FN Shop.",
  plan_limit_reached: "Se acabaron los requests del plan de FN Shop.",
  gift_outcome_unknown: "Epic no confirmó el envío. Concilia antes de reintentar.",
};

/** Motivos de `not_eligible_to_receive_gift` presentes en la respuesta. */
function reasonsOf(body: Record<string, unknown>): string[] {
  const reasons = body.reasons;
  if (!reasons || typeof reasons !== "object" || Array.isArray(reasons)) return [];
  return Object.entries(reasons as Record<string, unknown>)
    .filter(([, value]) => !Array.isArray(value) || value.length > 0)
    .map(([key]) => key);
}

function unixToIso(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : typeof value === "number" ? String(value) : null;
}

function price(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function giftCodeMessage(code: string, reasons: readonly string[] = []): string {
  if (reasons.length) return reasons.map((reason) => REASON_MESSAGES[reason] ?? reason).join(" ");
  return CODE_MESSAGES[code] ?? `FN Shop respondió «${code}».`;
}

export function interpretGiftCheck(body: Record<string, unknown>): GiftCheckResult {
  const code = text(body.code) ?? "sin_code";
  if (body.result === true && code === "eligible_to_receive_gift") {
    return { eligible: true, senderId: text(body.sender_id), finalPrice: price(body.final_price) };
  }
  const reasons = reasonsOf(body);
  return { eligible: false, code, message: giftCodeMessage(code, reasons), giftableAt: unixToIso(body.giftable_at), reasons };
}

export function interpretGiftSend(body: Record<string, unknown>): GiftSendResult {
  const code = text(body.code) ?? "sin_code";
  if (body.result === true && code === "gift_sent_successfully") {
    return { outcome: "sent", trackId: text(body.track_id), senderId: text(body.sender_id), senderName: text(body.sender), finalPrice: price(body.final_price) };
  }
  if (code === "gift_outcome_unknown" || body.outcome === "unknown") {
    return { outcome: "unknown", code, message: giftCodeMessage("gift_outcome_unknown"), senderId: text(body.sender_id), senderName: text(body.sender) };
  }
  // `result: true` con otro code no se toma como envío: puede ser un cambio de la API.
  if (body.result === true) return { outcome: "unknown", code, message: `FN Shop respondió «${code}» sin confirmar el envío. Concilia antes de reintentar.`, senderId: text(body.sender_id), senderName: text(body.sender) };
  const reasons = reasonsOf(body);
  return { outcome: "refused", code, message: giftCodeMessage(code, reasons), reasons };
}

/** Rechazos que piden atención en las cuentas remitentes: se avisa a Telegram. */
export function needsSenderAttention(reasons: readonly string[], code: string): boolean {
  return reasons.some((reason) => reason === "vbucks" || reason === "gifts" || reason === "token_expired")
    || code === "no_accounts_in_group" || code === "plan_limit_reached";
}
