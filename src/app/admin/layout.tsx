import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import { getSupabaseServer } from "@/shared/infrastructure/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sessionClient, database] = await Promise.all([getSupabaseServer(), Promise.resolve(getSupabaseAdmin())]);
  if (!sessionClient || !database) redirect("/cuenta?next=/admin");
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/cuenta?next=/admin");
  const { data: profile } = await database.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string }>();
  if (profile?.role !== "admin") redirect("/cuenta?error=admin");
  return children;
}
