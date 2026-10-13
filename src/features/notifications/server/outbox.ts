import type { SupabaseClient } from "@supabase/supabase-js";

export type OutboxJob = Readonly<{
  id: string;
  job_type: string;
  aggregate_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
}>;

export async function queueOutboxJob(
  database: SupabaseClient,
  input: { jobType: string; aggregateId?: string | null; payload?: Record<string, unknown>; dedupeKey: string; availableAt?: string },
): Promise<OutboxJob> {
  const { data: existing } = await database.from("outbox_jobs")
    .select("id,job_type,aggregate_id,payload,attempts")
    .eq("dedupe_key", input.dedupeKey)
    .maybeSingle<OutboxJob>();
  if (existing) return existing;

  const { data, error } = await database.from("outbox_jobs").insert({
    job_type: input.jobType,
    aggregate_id: input.aggregateId ?? null,
    payload: input.payload ?? {},
    dedupe_key: input.dedupeKey,
    available_at: input.availableAt ?? new Date().toISOString(),
  }).select("id,job_type,aggregate_id,payload,attempts").single<OutboxJob>();
  if (!error && data) return data;
  if (error?.code === "23505") {
    const { data: concurrent } = await database.from("outbox_jobs")
      .select("id,job_type,aggregate_id,payload,attempts")
      .eq("dedupe_key", input.dedupeKey)
      .single<OutboxJob>();
    if (concurrent) return concurrent;
  }
  throw error ?? new Error("No fue posible encolar el trabajo.");
}

export async function markOutboxSent(database: SupabaseClient, jobId: string, providerMessageId?: string | null) {
  const { error } = await database.from("outbox_jobs").update({
    status: "sent",
    sent_at: new Date().toISOString(),
    provider_message_id: providerMessageId ?? null,
    locked_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
  if (error) throw error;
}

export async function cancelOutboxJob(database: SupabaseClient, jobId: string) {
  const { error } = await database.from("outbox_jobs").update({
    status: "canceled",
    locked_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
  if (error) throw error;
}

export async function retryOutboxJob(database: SupabaseClient, job: OutboxJob, error: unknown) {
  const retryAt = new Date(Date.now() + Math.min(24 * 60 * 60_000, 5 * 60_000 * Math.max(1, job.attempts))).toISOString();
  const { error: updateError } = await database.from("outbox_jobs").update({
    status: "pending",
    locked_at: null,
    available_at: retryAt,
    last_error: error instanceof Error ? error.message.slice(0, 500) : "delivery_failed",
    updated_at: new Date().toISOString(),
  }).eq("id", job.id);
  if (updateError) throw updateError;
}
