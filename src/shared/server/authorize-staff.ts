import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

export async function authorizeStaff(request: Request, roles: readonly string[] = ["operator", "admin"]) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const database = getSupabaseAdmin();
  if (!token || !database) return null;
  const { data: { user }, error } = await database.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await database.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string }>();
  return profile && roles.includes(profile.role) ? { user, role: profile.role, database } : null;
}
