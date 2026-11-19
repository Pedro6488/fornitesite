import { NextResponse } from "next/server";
import { walletContext } from "@/features/wallet/server/context";
import { getFnShopClient } from "@/features/fnshop/server/get-fnshop-client";
import { PAYMENT_DETAILS } from "@/features/orders/config/payment-details";
export async function GET(request: Request) {
  const ctx = await walletContext(request);
  if (!ctx) return NextResponse.json({ error: "Inicia sesión para consultar tus pavos." }, { status: 401 });
  const { database, user } = ctx;
  const [account, rates, topups, movements, paused, offers] = await Promise.all([
    database.from("wallet_accounts").select("balance,frozen").eq("user_id", user.id).maybeSingle(),
    database.from("wallet_rates").select("region,cents_per_100,active"),
    database.from("wallet_topups").select("id,user_id,vbucks,region,amount_cents,status,review_note,created_at,expires_at,reference_code,bonus_vbucks").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    database.from("wallet_ledger").select("id,delta,kind,order_id,reason,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    database.rpc("wallet_payments_paused"),
    database.rpc("wallet_offers", { p_user: user.id }),
  ]);
  if ([account,rates,topups,movements,paused,offers].some((r) => r.error)) return NextResponse.json({ error: "El saldo de pavos aún no está disponible." }, { status: 503 });
  return NextResponse.json({ balance: account.data?.balance ?? 0, frozen: account.data?.frozen ?? false, paused: paused.data === true, tiers: offers.data?.tiers ?? [], bonuses: offers.data?.bonuses ?? [], rates: rates.data, topups: topups.data, movements: movements.data, automaticDelivery: Boolean(getFnShopClient(database)), paymentDetails: PAYMENT_DETAILS, supportWhatsapp: process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "") || "5215619857749" });
}
