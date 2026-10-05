import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function getRequestUser(request: Request, database: SupabaseClient): Promise<User | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await database.auth.getUser(token);
  return error ? null : data.user;
}
