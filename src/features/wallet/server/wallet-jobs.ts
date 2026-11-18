import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverOutboxJob } from "@/features/notifications/server/providers";
import { retryOutboxJob, type OutboxJob } from "@/features/notifications/server/outbox";
export async function runWalletJob(database: SupabaseClient, orderId: string | null = null) {
  const { data, error } = await database.rpc("claim_wallet_job", { p_order: orderId });
  if (error) throw error;
  const job = (data as OutboxJob[] | null)?.[0];
  if (!job) return false;
  try { await deliverOutboxJob(database,job); return true; }
  catch (error) { await retryOutboxJob(database,job,error); return false; }
}
