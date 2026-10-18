import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

export type StaffAuthorizationResult =
  | { ok: true; user: User; role: string; database: SupabaseClient }
  | { ok: false; status: 401 | 403 | 503 };

export async function authorizeStaffWithReason(
  request: Request,
  roles: readonly string[] = ["admin"],
): Promise<StaffAuthorizationResult> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const database = getSupabaseAdmin();
  if (!database) return { ok: false, status: 503 };
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await database.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const { data: profile } = await database.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string }>();
  if (!profile || !roles.includes(profile.role)) return { ok: false, status: 403 };
  return { ok: true, user, role: profile.role, database };
}

export async function authorizeStaff(request: Request, roles: readonly string[] = ["admin"]) {
  const result = await authorizeStaffWithReason(request, roles);
  return result.ok ? result : null;
}
