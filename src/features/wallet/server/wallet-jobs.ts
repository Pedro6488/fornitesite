import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverOutboxJob } from "@/features/notifications/server/providers";
import { retryOutboxJob, type OutboxJob } from "@/features/notifications/server/outbox";
import { sendOperationsAlert } from "@/features/fnshop/server/get-fnshop-client";

/** Después de este número de intentos la entrega deja de reintentarse sola y pasa a revisión del admin. */
export const WALLET_MAX_ATTEMPTS = 8;

export type WalletJobResult = "idle" | "done" | "retry" | "failed";

async function failWalletJob(database: SupabaseClient, job: OutboxJob, reason: string) {
  const { error } = await database.from("outbox_jobs").update({
    status: "failed", locked_at: null, last_error: reason.slice(0, 500), updated_at: new Date().toISOString(),
  }).eq("id", job.id);
  if (error) throw error;
  const order = job.aggregate_id ?? "";
  await sendOperationsAlert(database,
    `⛔ Pedido con pavos #${order.slice(0, 8).toUpperCase()} sin terminar tras ${job.attempts} intentos: ${reason.slice(0, 200)}. Ya no se reintenta solo; revísalo y concílialo a mano.`,
    `wallet:failed:${order}`, `/admin/pedidos/${order}`);
}

/** Reclama y procesa un trabajo de entrega con pavos (el de `orderId`, o el siguiente de la cola). */
export async function runWalletJob(database: SupabaseClient, orderId: string | null = null): Promise<WalletJobResult> {
  const { data, error } = await database.rpc("claim_wallet_job", { p_order: orderId });
  if (error) throw error;
  const job = (data as OutboxJob[] | null)?.[0];
  if (!job) return "idle";
  // Si el proceso murió varias veces a la mitad (timeout), el catch nunca corrió: se corta aquí.
  if (job.attempts > WALLET_MAX_ATTEMPTS) {
    await failWalletJob(database, job, "La entrega se interrumpió demasiadas veces.");
    return "failed";
  }
  try {
    await deliverOutboxJob(database, job);
    return "done";
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "delivery_failed";
    if (job.attempts >= WALLET_MAX_ATTEMPTS) { await failWalletJob(database, job, reason); return "failed"; }
    await retryOutboxJob(database, job, cause);
    return "retry";
  }
}

/** Vacía la cola dentro de un presupuesto de tiempo: el cron externo llama cada 5 minutos. */
export async function runWalletJobs(database: SupabaseClient, options: { maxJobs?: number; budgetMs?: number; now?: () => number } = {}) {
  const { maxJobs = 10, budgetMs = 45_000, now = Date.now } = options;
  const started = now();
  const summary = { processed: 0, retried: 0, failed: 0 };
  for (let index = 0; index < maxJobs && now() - started < budgetMs; index += 1) {
    const result = await runWalletJob(database);
    if (result === "idle") break;
    if (result === "done") summary.processed += 1;
    else if (result === "retry") summary.retried += 1;
    else summary.failed += 1;
  }
  return summary;
}
