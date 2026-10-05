import { NextResponse } from "next/server";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { authorizeStaff } from "@/shared/server/authorize-staff";

export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const view = new URL(request.url).searchParams.get("view") ?? "summary";
  if (view === "summary") return summary(staff.database);
  if (view === "carts") return carts(staff.database);
  if (view === "favorites") return favorites(staff.database);
  return NextResponse.json({ error: "Vista inválida." }, { status: 400 });
}

async function summary(database: NonNullable<Awaited<ReturnType<typeof authorizeStaff>>>["database"]) {
  const abandonedBefore = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [orders, receipts, activeCarts, abandonedCarts, favorites] = await Promise.all([
    database.from("orders").select("id", { count: "exact", head: true }).in("status", ["awaiting_transfer", "receipt_submitted", "transfer_review", "information_required", "paid", "ready_to_send", "validating_delivery", "delivering"]),
    database.from("orders").select("id", { count: "exact", head: true }).in("status", ["receipt_submitted", "transfer_review"]),
    database.from("shopping_carts").select("id", { count: "exact", head: true }).eq("status", "active").gte("updated_at", abandonedBefore),
    database.from("shopping_carts").select("id", { count: "exact", head: true }).eq("status", "active").lt("updated_at", abandonedBefore),
    database.from("customer_favorites").select("id", { count: "exact", head: true })
  ]);
  return NextResponse.json({ metrics: {
    pendingOrders: orders.count ?? 0,
    receiptsToReview: receipts.count ?? 0,
    activeCarts: activeCarts.count ?? 0,
    abandonedCarts: abandonedCarts.count ?? 0,
    favorites: favorites.count ?? 0
  }});
}

async function carts(database: NonNullable<Awaited<ReturnType<typeof authorizeStaff>>>["database"]) {
  const { data, error } = await database.from("shopping_carts")
    .select("id,status,created_at,updated_at,commerce_session_id,shopping_cart_items(item_main_id,quantity),commerce_sessions(whatsapp,user_id)")
    .order("updated_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: "No fue posible consultar carritos." }, { status: 503 });
  let prices = new Map<string, number>();
  try {
    const catalog = await (await getCatalogService()).list();
    prices = new Map(catalog.flatMap((item) => item.priceMxn === null ? [] : [[item.mainId, item.priceMxn * 100] as const]));
  } catch (error) {
    console.error("admin.carts.pricing.failed", error);
  }
  const rows = await Promise.all((data ?? []).map(async (cart) => {
    const { data: validation } = await database.from("game_id_validations").select("display_name,platform,status")
      .eq("commerce_session_id", cart.commerce_session_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const estimatedAmountMxnCents = cart.shopping_cart_items.reduce((sum, item) => sum + (prices.get(item.item_main_id) ?? 0), 0);
    return { ...cart, validation: validation ?? null, estimatedAmountMxnCents, abandoned: cart.status === "active" && new Date(cart.updated_at).getTime() < Date.now() - 24 * 60 * 60_000 };
  }));
  return NextResponse.json({ carts: rows });
}

async function favorites(database: NonNullable<Awaited<ReturnType<typeof authorizeStaff>>>["database"]) {
  const { data, error } = await database.from("customer_favorites").select("item_main_id,commerce_session_id,created_at,commerce_sessions(user_id)").order("created_at", { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: "No fue posible consultar favoritos." }, { status: 503 });
  const counts = new Map<string, number>();
  for (const favorite of data ?? []) counts.set(favorite.item_main_id, (counts.get(favorite.item_main_id) ?? 0) + 1);
  const ranking = [...counts].map(([itemMainId, count]) => ({ itemMainId, count })).sort((a, b) => b.count - a.count);
  return NextResponse.json({ favorites: data ?? [], ranking });
}
