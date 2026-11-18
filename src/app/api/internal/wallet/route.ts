import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import { runWalletJobs } from "@/features/wallet/server/wallet-jobs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const database = getSupabaseAdmin();
  if (!database) return NextResponse.json({ error: "Servicio no disponible." }, { status: 503 });
  try {
    const { data: expired, error } = await database.rpc("expire_wallet_topups");
    if (error) throw error;
    return NextResponse.json({ ...await runWalletJobs(database), expiredTopups: expired ?? 0 });
  } catch (error) {
    console.error("wallet.cron.failed", error);
    return NextResponse.json({ error: "No fue posible procesar la cola." }, { status: 503 });
  }
}
