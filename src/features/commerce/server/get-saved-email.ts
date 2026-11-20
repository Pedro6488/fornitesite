import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommerceSession } from "@/shared/server/commerce-session";

/** Reuse contact details without treating a saved address as marketing consent. */
export async function getSavedEmail(database: SupabaseClient, session: CommerceSession): Promise<string | null> {
  const scope = session.user ? `commerce_session_id.eq.${session.id},user_id.eq.${session.user.id}` : `commerce_session_id.eq.${session.id}`;
  const [contacts, orders] = await Promise.all([
    database.from("email_contacts").select("email,updated_at").or(scope).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    database.from("orders").select("customer_email,created_at").or(scope).not("customer_email", "is", null).neq("customer_email", "").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const candidates = [
    ...(contacts.data?.email ? [{ email: contacts.data.email, at: contacts.data.updated_at }] : []),
    ...(orders.data?.customer_email ? [{ email: orders.data.customer_email, at: orders.data.created_at }] : []),
  ];
  return candidates.sort((left, right) => Date.parse(right.at) - Date.parse(left.at))[0]?.email ?? session.user?.email ?? null;
}
