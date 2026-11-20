import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import type { WalletRate } from "../domain/wallet";
import type { PublicWalletOffers } from "../domain/wallet-offers";

/**
 * Tarifas activas, tramos y promociones vigentes para quien todavía no inicia sesión
 * (portada y /pavos). `wallet_offers(null)` ya filtra por vigencia y margen; las promociones
 * de primera recarga se muestran porque un visitante aún no tiene recargas aprobadas.
 * Devuelve null si la base no tiene pavos todavía: la página se muestra sin precios.
 */
export async function getPublicWalletOffers(): Promise<PublicWalletOffers | null> {
  const database = getSupabaseAdmin();
  if (!database) return null;
  try {
    const [rates, offers] = await Promise.all([
      database.from("wallet_rates").select("region,cents_per_100,active").eq("active", true),
      database.rpc("wallet_offers", { p_user: null }),
    ]);
    if (rates.error || offers.error) return null;
    return { rates: (rates.data ?? []) as WalletRate[], tiers: offers.data?.tiers ?? [], bonuses: offers.data?.bonuses ?? [] };
  } catch {
    return null;
  }
}
