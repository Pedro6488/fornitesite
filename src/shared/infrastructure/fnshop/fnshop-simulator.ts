import type { FnShopAction } from "./fnshop-budget";

/**
 * Respuestas simuladas de FN Shop para local, CI y QA (`FNSHOP_SIMULATE=true`).
 * La key real se liga al dominio en su primer uso, así que fuera de producción
 * nunca se llama a la API. Las formas siguen la documentación de FN Shop.
 *
 * Escenarios según el gamertag que escriba quien prueba:
 *   «noexiste»  → la cuenta no existe
 *   «listo»     → ya es amigo desde hace 48 h: se puede regalar
 *   «espera»    → ya es amigo pero faltan horas
 *   «privado»   → no acepta solicitudes de amistad
 *   «dudoso»    → el envío queda con resultado dudoso
 *   «rechazo»   → Epic rechaza la compra
 *   «sinsaldo»  → ninguna cuenta tiene paVos suficientes
 *   cualquier otro → solicitud enviada; tras «Ya acepté» empieza la espera de 48 h
 */
const SIMULATED_ACCOUNTS = [
  { account_id: "5f0a1b2c3d4e5f60718293a4b5c6d7e8", displayName: "SimGift1" },
  { account_id: "6a1b2c3d4e5f60718293a4b5c6d7e8f9", displayName: "SimGift2" },
];

function hex32(value: string): string {
  let hash = 2166136261;
  let out = "";
  for (let round = 0; out.length < 32; round += 1) {
    for (const character of `${round}:${value}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    out += hash.toString(16).padStart(8, "0");
  }
  return out.slice(0, 32);
}

function scenario(receiver: string): string {
  const name = receiver.toLowerCase();
  return ["noexiste", "listo", "espera", "privado", "dudoso", "rechazo", "sinsaldo"].find((key) => name.includes(key)) ?? "default";
}

export function simulateFnShop(action: FnShopAction, params: Record<string, string>, now: Date = new Date()): Record<string, unknown> {
  const receiver = params.receiver ?? "";
  const kind = scenario(receiver);
  const receiverId = hex32(receiver.toLowerCase());
  const seconds = Math.floor(now.getTime() / 1000);

  switch (action) {
    case "verify_license":
      return { result: true, code: "license_valid", user_id: 0, plan: "simulated" };
    case "friend_add": {
      if (kind === "noexiste") return { result: false, code: "receiver_account_not_found", receiver };
      if (kind === "privado") return { result: false, code: "receiver_not_accepting_friends", receiver, receiver_id: receiverId };
      const friends = kind === "listo" || kind === "espera" || kind === "dudoso" || kind === "rechazo" || kind === "sinsaldo";
      const giftableAt = kind === "espera" ? seconds + 30 * 3600 : friends ? seconds - 3600 : null;
      return {
        result: true,
        code: friends ? "already_friends" : "friend_request_sent",
        receiver: receiverId, receiver_id: receiverId,
        sent: friends ? 0 : SIMULATED_ACCOUNTS.length,
        already_friends: friends ? SIMULATED_ACCOUNTS.length : 0,
        failed: 0, skipped: 0,
        can_gift_now: friends && kind !== "espera",
        giftable_at: giftableAt,
        giftable_in: giftableAt ? Math.max(0, giftableAt - seconds) : null,
        accounts_total: SIMULATED_ACCOUNTS.length, accounts_tried: SIMULATED_ACCOUNTS.length, truncated: false,
        accounts: SIMULATED_ACCOUNTS.map((account) => ({
          ...account, status: friends ? "already_friends" : "sent",
          friends_since: friends ? seconds - 50 * 3600 : null, giftable_at: giftableAt, can_gift_now: friends && kind !== "espera",
        })),
      };
    }
    case "friend_status": {
      const waiting = kind === "default" || kind === "espera";
      const readyInHours = kind === "espera" ? 30 : 47.9;
      return {
        result: true, code: "friend_status",
        ready: waiting ? 0 : SIMULATED_ACCOUNTS.length, waiting: waiting ? SIMULATED_ACCOUNTS.length : 0, pending: 0, none: 0,
        min_hours: 48, soonest_hours: waiting ? readyInHours : null,
        accounts: SIMULATED_ACCOUNTS.map((account) => ({
          ...account, state: "friends", created: new Date(now.getTime() - (48 - readyInHours) * 3600_000).toISOString(),
          hours: waiting ? 48 - readyInHours : 50, giftable: !waiting, ready_in_hours: waiting ? readyInHours : 0,
        })),
      };
    }
    case "gift_check":
      if (kind === "espera") return { result: false, code: "not_eligible_to_receive_gift", reasons: { friendship_not_passed: [SIMULATED_ACCOUNTS[0].account_id] }, giftable_at: seconds + 30 * 3600, giftable_in: 30 * 3600 };
      if (kind === "sinsaldo") return { result: false, code: "not_eligible_to_receive_gift", reasons: { vbucks: SIMULATED_ACCOUNTS.map((account) => account.account_id) }, giftable_at: null, giftable_in: null };
      if (kind === "rechazo") return { result: false, code: "purchase_not_allowed" };
      return { result: true, code: "eligible_to_receive_gift", receiver_id: receiverId, sender_id: SIMULATED_ACCOUNTS[0].account_id, eligible_accounts: [SIMULATED_ACCOUNTS[0].account_id], category: params.category ?? "default", final_price: null };
    case "gift_send":
      if (kind === "dudoso") return { result: false, code: "gift_outcome_unknown", outcome: "unknown", order_id: params.order_id ?? null, sender_id: SIMULATED_ACCOUNTS[0].account_id, sender: SIMULATED_ACCOUNTS[0].displayName };
      if (kind === "rechazo") return { result: false, code: "purchase_not_allowed", order_id: params.order_id ?? null };
      if (kind === "sinsaldo") return { result: false, code: "not_eligible_to_receive_gift", reasons: { vbucks: SIMULATED_ACCOUNTS.map((account) => account.account_id) } };
      return {
        result: true, code: "gift_sent_successfully", track_id: `sim-${hex32(`${params.order_id}:${seconds}`).slice(0, 12)}`,
        sender_id: SIMULATED_ACCOUNTS[0].account_id, sender: SIMULATED_ACCOUNTS[0].displayName, receiver_id: receiverId,
        order_id: params.order_id ?? null, category: params.category ?? "default", final_price: null, date: seconds,
      };
    case "order_history": {
      // Un envío dudoso aparece en el historial: así se puede probar la conciliación.
      const orders = params.order_id ? [{ id: `sim-${params.order_id.slice(0, 8)}`, date: seconds - 60, type: "api_gift", status: "completed", receiver: receiverId, sender: SIMULATED_ACCOUNTS[0].account_id, offer: "sim-offer", price: 0, order_id: params.order_id, category: "default" }] : [];
      return { result: true, code: "order_history", total: orders.length, spent: 0, limit: 50, offset: 0, types: { api_gift: orders.length }, orders };
    }
    case "shop":
      return { result: true, code: "shop", uid: "simulated", count: 0, total: 0, items: [] };
    case "groups_status":
      return { result: true, code: "groups_status", plan: { plan: "simulated", used: 0, remaining: 5000, resets_at: seconds + 30 * 86400 }, categories: [] };
  }
}
