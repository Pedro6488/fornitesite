import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import { getSupabaseServer } from "@/shared/infrastructure/supabase/server";
import "../admin-console.css";

export const metadata: Metadata = { title: "Consola · SigfriedLootBox", robots: { index: false, follow: false } };

/**
 * Consola de administración. Comprueba el rol y dibuja su propio marco:
 * la cabecera y el pie de la tienda no aparecen aquí (ver `SiteFrame`).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sessionClient, database] = await Promise.all([getSupabaseServer(), Promise.resolve(getSupabaseAdmin())]);
  if (!sessionClient || !database) redirect("/acceso-admin");
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/acceso-admin");
  const { data: profile } = await database.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string }>();
  if (profile?.role !== "admin") redirect("/cuenta?error=admin");
  return <AdminShell deliveryMode={process.env.FULFILLMENT_MODE === "fnshop" ? "automatic" : "manual"}>{children}</AdminShell>;
}
