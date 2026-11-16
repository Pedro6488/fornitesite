/**
 * Cómo se lee lo que responde FN Shop sobre la amistad con un destinatario.
 * Funciones puras: las rutas deciden qué guardar a partir de estos resultados.
 */
export type RecipientPlatform = "epic" | "xbl" | "psn" | "nintendo";

const EPIC_ID = /^[0-9a-f]{32}$/;
const MAX_FRIENDSHIP_CHECKS = 3;
const FRIENDSHIP_CHECK_COOLDOWN_MS = 30 * 60_000;

/** Nombre que entiende FN Shop: las consolas llevan prefijo (`psn:`, `xbl:`, `nintendo:`). */
export function fnShopReceiver(platform: RecipientPlatform | string, displayName: string): string {
  const name = displayName.trim();
  return platform === "xbl" || platform === "psn" || platform === "nintendo" ? `${platform}:${name}` : name;
}

/** El Epic ID real solo se usa si tiene la forma correcta; si no, FN Shop resuelve por nombre. */
export function validReceiverId(value: unknown): string | null {
  return typeof value === "string" && EPIC_ID.test(value.toLowerCase()) ? value.toLowerCase() : null;
}

function unixToIso(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}

const CUSTOMER_FIXES: Record<string, string> = {
  receiver_account_not_found: "No encontramos esa cuenta. Revisa el gamertag y la plataforma.",
  receiver_account_banned: "Esa cuenta no puede recibir regalos en Fortnite.",
  receiver_not_accepting_friends: "Tu cuenta no acepta solicitudes de amistad. Actívalas en Fortnite y vuelve a guardar tu ID.",
  receiver_friends_list_full: "Tu lista de amigos está llena. Libera un espacio en Fortnite y vuelve a guardar tu ID.",
  receiver_request_list_full: "Tienes demasiadas solicitudes pendientes. Acepta o rechaza algunas en Fortnite y vuelve a guardar tu ID.",
};

export type FriendAddOutcome =
  | { kind: "ready"; receiverId: string | null }
  | { kind: "waiting"; receiverId: string | null; giftableAt: string }
  | { kind: "pending"; receiverId: string | null }
  | { kind: "customer_fix"; code: string; message: string }
  | { kind: "manual"; code: string | null };

/** Resultado de `friend_add`: una sola llamada valida el ID y envía la solicitud desde las cuentas remitentes. */
export function interpretFriendAdd(body: Record<string, unknown>, now: Date = new Date()): FriendAddOutcome {
  const code = typeof body.code === "string" ? body.code : null;
  if (code && CUSTOMER_FIXES[code]) return { kind: "customer_fix", code, message: CUSTOMER_FIXES[code] };
  const receiverId = validReceiverId(body.receiver_id);
  if (body.can_gift_now === true) return { kind: "ready", receiverId };
  const giftableAt = unixToIso(body.giftable_at);
  if (giftableAt) {
    return Date.parse(giftableAt) <= now.getTime() ? { kind: "ready", receiverId } : { kind: "waiting", receiverId, giftableAt };
  }
  const sent = typeof body.sent === "number" ? body.sent : Number(body.sent) || 0;
  if (sent > 0 || code === "friend_request_sent" || code === "partially_sent" || code === "already_friends") return { kind: "pending", receiverId };
  // friend_request_failed, friends_lists_full (nuestras cuentas), un code nuevo: lo resuelve el equipo.
  return { kind: "manual", code };
}

export type FriendStatusOutcome =
  | { kind: "ready" }
  | { kind: "waiting"; giftableAt: string }
  | { kind: "pending" }
  | { kind: "none" };

type StatusAccount = { state?: unknown; giftable?: unknown; ready_in_hours?: unknown };

/**
 * Resultado de `friend_status` cuando el cliente pulsa «Ya acepté».
 * Las 48 h cuentan desde que el cliente acepta; con esta respuesta sabemos la hora exacta
 * y desde ahí la espera se cuenta en nuestra base, sin volver a llamar.
 */
export function interpretFriendStatus(body: Record<string, unknown>, now: Date = new Date()): FriendStatusOutcome {
  const count = (value: unknown) => (typeof value === "number" ? value : Number(value) || 0);
  const accounts = Array.isArray(body.accounts) ? (body.accounts as StatusAccount[]) : [];
  if (count(body.ready) > 0 || accounts.some((account) => account.giftable === true)) return { kind: "ready" };
  if (count(body.waiting) > 0 || accounts.some((account) => account.state === "friends")) {
    const hours = accounts
      .filter((account) => account.state === "friends" && account.giftable !== true)
      .map((account) => Number(account.ready_in_hours))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const soonest = hours.length ? Math.min(...hours) : Number(body.soonest_hours);
    // Sin dato confiable se asume la espera completa: la falta de datos nunca cuenta como «listo».
    const waitHours = Number.isFinite(soonest) && soonest >= 0 ? soonest : 48;
    return { kind: "waiting", giftableAt: new Date(now.getTime() + waitHours * 3600_000).toISOString() };
  }
  if (count(body.pending) > 0) return { kind: "pending" };
  return { kind: "none" };
}

export type FriendshipCheckGate = { allowed: true } | { allowed: false; message: string };

/** «Ya acepté» se puede pulsar 3 veces por ID, con 30 minutos entre intentos. Es el único refresco que existe. */
export function friendshipCheckGate(checks: number, lastCheckedAt: string | null, now: Date = new Date()): FriendshipCheckGate {
  if (checks >= MAX_FRIENDSHIP_CHECKS) {
    return { allowed: false, message: "Ya revisamos tu solicitud varias veces. El equipo la confirmará y te avisará por WhatsApp." };
  }
  const last = lastCheckedAt ? Date.parse(lastCheckedAt) : Number.NaN;
  if (Number.isFinite(last) && now.getTime() - last < FRIENDSHIP_CHECK_COOLDOWN_MS) {
    const minutes = Math.ceil((FRIENDSHIP_CHECK_COOLDOWN_MS - (now.getTime() - last)) / 60_000);
    return { allowed: false, message: `Acabamos de revisar. Vuelve a intentarlo en ${minutes} min, después de aceptar la solicitud en Fortnite.` };
  }
  return { allowed: true };
}

export const FRIENDSHIP_CHECKS_LIMIT = MAX_FRIENDSHIP_CHECKS;
