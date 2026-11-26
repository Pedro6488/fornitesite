import type { SupabaseClient } from "@supabase/supabase-js";
import { queueOutboxJob } from "@/features/notifications/server/outbox";
import { deliverOutboxJob } from "@/features/notifications/server/providers";
import { FnShopClient, fnShopAvailable, fnShopConfigFromEnv, type FnShopCaller } from "@/shared/infrastructure/fnshop/fnshop-client";
import { OwnApiFirstCaller, ownApiConfigFromEnv } from "@/shared/infrastructure/fnshop/own-api-router";

/** La entrega automática está encendida (`FULFILLMENT_MODE=fnshop`). */
export function automaticDeliveryEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.FULFILLMENT_MODE === "fnshop";
}

/** Manda a Telegram un aviso operativo una sola vez por llave. Si Telegram falla, la cola lo reintenta. */
export async function sendOperationsAlert(database: SupabaseClient, text: string, dedupeKey: string, path = "/admin/fnshop") {
  const job = await queueOutboxJob(database, { jobType: "telegram.operations.alert", payload: { text, path }, dedupeKey });
  try { await deliverOutboxJob(database, job); }
  catch (error) { console.error("telegram.operations.immediate.failed", { dedupeKey, error }); }
}

/**
 * Cliente de FN Shop listo para usar, o `null` si en este entorno no se puede
 * (sin modo automático, sin key en producción, o fuera de producción sin simulador).
 *
 * Con `OWN_API_BASE_URL` y `OWN_API_KEY` en producción, `friend_add` y `friend_status` van
 * primero a nuestra API (FN Shop queda de respaldo) y `gift_check` se compara en paralelo.
 * Con `OWN_API_GIFTS=on`, además, los envíos y la conciliación salen por nuestra API.
 * Sin esas variables todo sigue exactamente como antes.
 */
export function getFnShopClient(database: SupabaseClient, options: { requireAutomatic?: boolean } = {}): FnShopCaller | null {
  // «Verificar key» se permite antes de encender la entrega automática, para ligar el dominio.
  if ((options.requireAutomatic ?? true) && !automaticDeliveryEnabled()) return null;
  const config = fnShopConfigFromEnv();
  if (!fnShopAvailable(config)) return null;
  const fnshop = new FnShopClient(database, config, { alert: (text, dedupeKey) => sendOperationsAlert(database, text, dedupeKey) });
  const own = ownApiConfigFromEnv(process.env, config);
  return own ? new OwnApiFirstCaller(database, fnshop, own) : fnshop;
}
