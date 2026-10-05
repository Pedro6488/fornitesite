import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function consumeCommerceRateLimit(
  database: SupabaseClient,
  key: string,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const keyHash = createHash("sha256").update(key).digest("hex");
  const { data, error } = await database.rpc("consume_commerce_rate_limit", {
    p_key_hash: keyHash,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });
  if (error) throw error;
  return data === true;
}
