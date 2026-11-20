import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import { getRequestUser } from "@/shared/server/request-user";
export async function walletContext(request: Request) {
  const database = getSupabaseAdmin();
  if (!database) return null;
  const user = await getRequestUser(request, database);
  return user ? { database, user } : null;
}
