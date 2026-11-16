import type { SupabaseClient } from "@supabase/supabase-js";
import type { FnShopAction } from "@/shared/infrastructure/fnshop/fnshop-budget";
import { getFnShopClient } from "./get-fnshop-client";

/**
 * Presupuesto de aprendizaje (opcional, `FNSHOP_LEARNING_SNAPSHOTS=true`): ~64 requests al mes
 * que solo alimentan la bitácora, nunca una pantalla de la tienda.
 *  - groups_status live=1 cada día: saldo, cupo y prioridad reales de las cuentas remitentes.
 *  - shop cada día: relación offerId ↔ mainId y rotación de la tienda.
 *  - order_history cada lunes: registro de FN Shop, incluidos regalos hechos desde la miniapp.
 * Corre con el cron diario; si el cron se repite el mismo día, no vuelve a llamar.
 */
export async function captureLearningSnapshots(database: SupabaseClient, now: Date = new Date()): Promise<string[]> {
  if (process.env.FNSHOP_LEARNING_SNAPSHOTS !== "true") return [];
  const client = getFnShopClient(database);
  if (!client) return [];

  const today = now.toISOString().slice(0, 10);
  const plan: { action: FnShopAction; params: Record<string, string> }[] = [
    { action: "groups_status", params: { live: "1" } },
    { action: "shop", params: { giftable: "1" } },
    ...(now.getUTCDay() === 1 ? [{ action: "order_history" as const, params: { limit: "200", from: new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10) } }] : []),
  ];

  const captured: string[] = [];
  for (const entry of plan) {
    const { count } = await database.from("provider_api_calls").select("id", { count: "exact", head: true })
      .eq("action", entry.action).eq("trigger", "system").gte("created_at", `${today}T00:00:00Z`);
    if ((count ?? 0) > 0) continue;
    try {
      const response = await client.call(entry.action, entry.params, { trigger: "system", correlationId: `learning:${today}` });
      await client.decide(response.callId, "learning_snapshot");
      captured.push(entry.action);
    } catch (error) {
      // Una captura fallida no detiene el cron; la cuota en reserva también la bloquea.
      console.error("fnshop.learning.snapshot.failed", { action: entry.action, error });
    }
  }
  return captured;
}
