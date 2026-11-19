import type { SupabaseClient } from "@supabase/supabase-js";

/** Pausa el pago con pavos 30 min cuando falla la cuenta emisora (sin paVos, sin cupo, FN Shop caído). */
export async function pauseWalletPayments(database: SupabaseClient, reason: string) {
  const { data, error } = await database.rpc("pause_wallet_payments", { p_minutes: 30, p_reason: reason });
  if (error) throw error;
  return data as string | null;
}

export async function walletPaymentsPaused(database: SupabaseClient) {
  const { data, error } = await database.rpc("wallet_payments_paused");
  if (error) throw error;
  return data === true;
}
