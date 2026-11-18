import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/shared/server/authorize-staff";
export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const userId = new URL(request.url).searchParams.get("userId");
  if (userId && !z.uuid().safeParse(userId).success) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  if (userId) {
    const [ledger, orders, topups] = await Promise.all([
      staff.database.from("wallet_ledger").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      staff.database.from("orders").select("id,status,epic_display_name,wallet_vbucks,created_at,order_items(item_name,vbucks_price,wallet_refunded),fulfillments(order_item_id,status,last_error)").eq("user_id", userId).eq("payment_source","wallet").order("created_at", { ascending: false }).limit(200),
      staff.database.from("wallet_topups").select("id,user_id,vbucks,region,amount_cents,status,created_at,expires_at,review_note,reference_code").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    ]);
    if (ledger.error || orders.error || topups.error) return NextResponse.json({ error: "No fue posible consultar el historial." }, { status: 503 });
    return NextResponse.json({ movements: ledger.data, orders: orders.data, topups: topups.data });
  }
  const [accounts, pending, rates] = await Promise.all([
    staff.database.from("wallet_customer_totals").select("*").order("updated_at", { ascending: false }).limit(500),
    staff.database.from("wallet_topups").select("*").eq("status","submitted").order("created_at").limit(100),
    staff.database.from("wallet_rates").select("region,cents_per_100,active"),
  ]);
  if (accounts.error || pending.error || rates.error) return NextResponse.json({ error: "No fue posible consultar los saldos. Verifica que la migración esté aplicada." }, { status: 503 });
  const topups = await Promise.all((pending.data ?? []).map(async (t) => ({ ...t, receiptUrl: t.receipt_path ? (await staff.database.storage.from("wallet-receipts").createSignedUrl(t.receipt_path,600)).data?.signedUrl ?? null : null })));
  return NextResponse.json({ accounts: accounts.data, pending: topups, rates: rates.data });
}
const reason = z.string().trim().max(500);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rate"), region: z.enum(["mx","us"]), centsPer100: z.number().int().min(1).max(1000000), active: z.boolean() }),
  z.object({ action: z.literal("review"), id: z.uuid(), approve: z.boolean(), note: z.string().trim().max(1000).default("") }),
  z.object({ action: z.literal("adjust"), userId: z.uuid(), delta: z.number().int().min(-1000000).max(1000000).refine((n) => n !== 0), reason: reason.min(5), orderId: z.uuid().optional() }),
  z.object({ action: z.literal("freeze"), userId: z.uuid(), frozen: z.boolean(), reason: reason.default("") }),
]);
const adjustErrors: Record<string,string> = {
  adjustment_exceeds_balance: "El ajuste dejaría el saldo en negativo. Si el cliente ya gastó los pavos, congela la cuenta.",
  reason_required: "Escribe un motivo de al menos 5 caracteres.",
  not_found: "No se encontró al cliente.",
  invalid_adjustment: "La cantidad del ajuste no es válida.",
};
export async function POST(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  const data = body.data;
  if (data.action === "rate") {
    const { error } = await staff.database.from("wallet_rates").update({ cents_per_100: data.centsPer100, active: data.active, updated_at: new Date().toISOString() }).eq("region",data.region);
    if (error) return NextResponse.json({ error: "No fue posible guardar la tarifa." }, { status: 503 });
    await staff.database.from("audit_log").insert({ actor_id: staff.user.id, action: "wallet.rate", entity_type: "wallet_rate", entity_id: data.region, after_data: data });
  } else if (data.action === "review") {
    if (!data.approve && data.note.length < 5) return NextResponse.json({ error: "Escribe el motivo del rechazo." }, { status: 400 });
    const { error } = await staff.database.rpc("review_wallet_topup", { p_id: data.id, p_actor: staff.user.id, p_approve: data.approve, p_note: data.note });
    if (error) return NextResponse.json({ error: "La recarga ya fue revisada o no tiene un comprobante válido." }, { status: 409 });
  } else if (data.action === "adjust") {
    const { data: balance, error } = await staff.database.rpc("adjust_wallet", { p_user: data.userId, p_actor: staff.user.id, p_delta: data.delta, p_reason: data.reason, p_order: data.orderId ?? null });
    if (error) {
      const code = Object.keys(adjustErrors).find((key) => error.message.includes(key));
      return NextResponse.json({ error: code ? adjustErrors[code] : "No fue posible ajustar el saldo." }, { status: code ? 409 : 503 });
    }
    return NextResponse.json({ ok: true, balance });
  } else {
    if (data.frozen && data.reason.length < 5) return NextResponse.json({ error: "Escribe el motivo del congelamiento." }, { status: 400 });
    const { error } = await staff.database.rpc("set_wallet_frozen", { p_user: data.userId, p_actor: staff.user.id, p_frozen: data.frozen, p_reason: data.reason });
    if (error) return NextResponse.json({ error: error.message.includes("not_found") ? "No se encontró al cliente." : "No fue posible cambiar el estado de la cuenta." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
