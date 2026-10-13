import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordCartActivity(database: SupabaseClient, sessionId: string, cartId: string, updatedAt: string) {
  const { data: session, error: sessionError } = await database.from("commerce_sessions")
    .select("email_contact_id").eq("id", sessionId).maybeSingle<{ email_contact_id: string | null }>();
  if (sessionError) throw sessionError;
  if (!session?.email_contact_id) return;
  const { error } = await database.from("cart_recovery_campaigns").upsert({
    cart_id: cartId,
    contact_id: session.email_contact_id,
    last_activity_at: updatedAt,
    canceled_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "cart_id" });
  if (error) throw error;
}
