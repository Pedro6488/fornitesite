import type { SupabaseClient } from "@supabase/supabase-js";
import { queueOutboxJob } from "@/features/notifications/server/outbox";
import { deliverOutboxJob } from "@/features/notifications/server/providers";
import { FnShopClient, fnShopAvailable, fnShopConfigFromEnv } from "@/shared/infrastructure/fnshop/fnshop-client";

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
 */
export function getFnShopClient(database: SupabaseClient, options: { requireAutomatic?: boolean } = {}): FnShopClient | null {
  // «Verificar key» se permite antes de encender la entrega automática, para ligar el dominio.
  if ((options.requireAutomatic ?? true) && !automaticDeliveryEnabled()) return null;
  const config = fnShopConfigFromEnv();
  if (!fnShopAvailable(config)) return null;
  return new FnShopClient(database, config, { alert: (text, dedupeKey) => sendOperationsAlert(database, text, dedupeKey) });
}
