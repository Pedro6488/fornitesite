import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import { cancelOutboxJob, queueOutboxJob, retryOutboxJob, type OutboxJob } from "@/features/notifications/server/outbox";
import { deliverOutboxJob } from "@/features/notifications/server/providers";

type Campaign = { cart_id: string; contact_id: string; last_activity_at: string; first_sent_at: string | null; second_sent_at: string | null; canceled_at: string | null };
type Cart = { id: string; status: string; updated_at: string };

async function queueEligibleCartRecoveryJobs(database: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  const { data: campaigns, error } = await database.from("cart_recovery_campaigns")
    .select("cart_id,contact_id,last_activity_at,first_sent_at,second_sent_at,canceled_at")
    .is("canceled_at", null).limit(100) as { data: Campaign[] | null; error: unknown };
  if (error) throw error;
  let queued = 0;
  for (const campaign of campaigns ?? []) {
    const { data: cart } = await database.from("shopping_carts").select("id,status,updated_at").eq("id", campaign.cart_id).maybeSingle<Cart>();
    if (!cart || cart.status !== "active") {
      await database.from("cart_recovery_campaigns").update({ canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("cart_id", campaign.cart_id);
      continue;
    }
    if (cart.updated_at !== campaign.last_activity_at) {
      await database.from("cart_recovery_campaigns").update({ last_activity_at: cart.updated_at, updated_at: new Date().toISOString() }).eq("cart_id", campaign.cart_id);
      continue;
    }
    const inactiveFor = Date.now() - new Date(cart.updated_at).getTime();
    if (inactiveFor < 24 * 60 * 60_000) continue;
    if (!campaign.first_sent_at) {
      await queueOutboxJob(database, {
        jobType: "email.cart.recovery", aggregateId: campaign.cart_id,
        payload: { cartId: campaign.cart_id, reminder: 1 },
        dedupeKey: `email:cart:${campaign.cart_id}:recovery:1:${campaign.last_activity_at}`,
      });
      queued += 1;
      continue;
    }
    if (!campaign.second_sent_at && Date.now() - new Date(campaign.first_sent_at).getTime() >= 24 * 60 * 60_000) {
      await queueOutboxJob(database, {
        jobType: "email.cart.recovery", aggregateId: campaign.cart_id,
        payload: { cartId: campaign.cart_id, reminder: 2 },
        dedupeKey: `email:cart:${campaign.cart_id}:recovery:2:${campaign.first_sent_at}`,
      });
      queued += 1;
    }
  }
  return queued;
}

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const database = getSupabaseAdmin(); if (!database) return NextResponse.json({ error: "Supabase no configurado." }, { status: 503 });
  const { data: removedSessions } = await database.rpc("cleanup_expired_commerce_sessions");
  try {
    const recoveryQueued = await queueEligibleCartRecoveryJobs(database);
    const { data: claimed, error } = await database.rpc("claim_outbox_jobs", { p_limit: 50 }) as { data: OutboxJob[] | null; error: unknown };
    if (error) throw error;
    let sent = 0;
    let failed = 0;
    for (const job of claimed ?? []) {
      try {
        await deliverOutboxJob(database, job);
        sent += 1;
      } catch (deliveryError) {
        failed += 1;
        console.error("outbox.delivery.failed", { id: job.id, type: job.job_type, deliveryError });
        await retryOutboxJob(database, job, deliveryError);
      }
    }
    return NextResponse.json({ processed: (claimed ?? []).length, sent, failed, recoveryQueued, removedSessions: Number(removedSessions ?? 0) });
  } catch (error) {
    console.error("internal.jobs.failed", error);
    return NextResponse.json({ error: "No fue posible procesar los trabajos." }, { status: 503 });
  }
}
