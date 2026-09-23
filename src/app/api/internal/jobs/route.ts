import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const database = getSupabaseAdmin(); if (!database) return NextResponse.json({ error: "Supabase no configurado." }, { status: 503 });
  const { data, error } = await database.from("outbox_jobs").select("id,job_type,payload").eq("status", "pending").lte("available_at", new Date().toISOString()).limit(25);
  if (error) return NextResponse.json({ error: "No fue posible consultar trabajos." }, { status: 503 });
  return NextResponse.json({ pending: data.length, note: "Los procesadores de correo y reembolso se conectan por job_type." });
}
