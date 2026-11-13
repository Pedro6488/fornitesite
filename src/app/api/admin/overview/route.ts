import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOperationsOverview, overviewWindowStart, OVERVIEW_RANGES, type OverviewOrder, type OverviewValidation } from "@/features/admin/application/operations-overview";
import { RECEIPT_REVIEW_STATUSES, statusesOf } from "@/features/admin/application/order-queues";
import type { IdentityValidationStatus } from "@/features/commerce/application/identity-review-state";
import type { OrderStatus } from "@/features/orders/domain/order";
import { authorizeStaff } from "@/shared/server/authorize-staff";

// Todo sale de nuestra base. Abrir o refrescar la consola no llama a ningún proveedor.

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

type Page<T> = { data: T[] | null; error: unknown };

/** PostgREST devuelve como máximo 1,000 filas por consulta; se pagina para no truncar en silencio. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const { data, error } = await page(index * PAGE_SIZE, (index + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  return rows;
}

type OrderRow = { id: string; status: OrderStatus; created_at: string; updated_at: string | null; paid_at: string | null; delivered_at: string | null; amount_mxn_cents: number; epic_account_id: string };
type OrderDetailRow = {
  id: string; item_main_id: string; item_name: string; item_image_url: string | null; amount_mxn_cents: number;
  order_items: { item_main_id: string; item_name: string; item_image_url: string | null; quantity: number; unit_amount_mxn_cents: number }[] | null;
  transfer_receipts: { created_at: string }[] | null;
};
type ValidationRow = { epic_account_id: string; status: IdentityValidationStatus; giftable_at: string | null };

function pendingValidations(database: SupabaseClient) {
  return fetchAll<ValidationRow>((from, to) => database.from("game_id_validations")
    .select("epic_account_id,status,giftable_at,commerce_sessions!game_id_validations_commerce_session_id_fkey!inner(merged_into)")
    .is("commerce_sessions.merged_into", null)
    .order("created_at", { ascending: false })
    .range(from, to));
}

function toValidation(row: ValidationRow): OverviewValidation {
  return { recipientId: row.epic_account_id, status: row.status, giftableAt: row.giftable_at };
}

export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const url = new URL(request.url);
  try {
    if (url.searchParams.get("view") === "counts") return await counts(staff.database);
    const requested = Number(url.searchParams.get("days") ?? 30);
    const days = OVERVIEW_RANGES.find((value) => value === requested) ?? 30;
    return await overview(staff.database, days);
  } catch (error) {
    console.error("admin.overview.failed", error);
    return NextResponse.json({ error: "No fue posible calcular el tablero." }, { status: 503 });
  }
}

/** Contadores ligeros para la barra de navegación. */
async function counts(database: SupabaseClient) {
  const open = [...statusesOf("payment"), ...statusesOf("deliver"), ...statusesOf("problem")];
  const [orders, validations] = await Promise.all([
    fetchAll<Pick<OrderRow, "status">>((from, to) => database.from("orders").select("status").in("status", open).range(from, to)),
    pendingValidations(database),
  ]);
  const count = (statuses: readonly OrderStatus[]) => orders.filter((order) => statuses.includes(order.status)).length;
  const recipients = buildOperationsOverview({ orders: [], validations: validations.map(toValidation), now: new Date(), days: 7 }).queues.recipients.count;
  return NextResponse.json({ counts: { receipts: count(RECEIPT_REVIEW_STATUSES), deliver: count(statusesOf("deliver")), problem: count(statusesOf("problem")), recipients } });
}

async function overview(database: SupabaseClient, days: number) {
  const now = new Date();
  const windowStart = overviewWindowStart(now, days).toISOString();
  const abandonedBefore = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();

  const [orders, details, validations, activeCarts, abandonedCarts, favorites] = await Promise.all([
    fetchAll<OrderRow>((from, to) => database.from("orders")
      .select("id,status,created_at,updated_at,paid_at,delivered_at,amount_mxn_cents,epic_account_id")
      .order("created_at", { ascending: false }).range(from, to)),
    fetchAll<OrderDetailRow>((from, to) => database.from("orders")
      .select("id,item_main_id,item_name,item_image_url,amount_mxn_cents,order_items(item_main_id,item_name,item_image_url,quantity,unit_amount_mxn_cents),transfer_receipts(created_at)")
      .or(`created_at.gte.${windowStart},paid_at.gte.${windowStart},delivered_at.gte.${windowStart}`)
      .order("created_at", { ascending: false }).range(from, to)),
    pendingValidations(database),
    database.from("shopping_carts").select("id,commerce_sessions!inner(merged_into),shopping_cart_items!inner(id)", { count: "exact", head: true }).eq("status", "active").is("commerce_sessions.merged_into", null).gte("updated_at", abandonedBefore),
    database.from("shopping_carts").select("id,commerce_sessions!inner(merged_into),shopping_cart_items!inner(id)", { count: "exact", head: true }).eq("status", "active").is("commerce_sessions.merged_into", null).lt("updated_at", abandonedBefore),
    database.from("customer_favorites").select("id,commerce_sessions!inner(merged_into)", { count: "exact", head: true }).is("commerce_sessions.merged_into", null),
  ]);
  if (activeCarts.error || abandonedCarts.error || favorites.error) throw activeCarts.error ?? abandonedCarts.error ?? favorites.error;

  const detailById = new Map(details.map((detail) => [detail.id, detail]));
  const overviewOrders = orders.map((order): OverviewOrder => {
    const detail = detailById.get(order.id);
    const lines = detail?.order_items?.length
      ? detail.order_items.map((item) => ({ mainId: item.item_main_id, name: item.item_name, imageUrl: item.item_image_url, quantity: item.quantity, unitAmountMxnCents: item.unit_amount_mxn_cents }))
      // Los pedidos anteriores al carrito guardan su único objeto en la propia fila.
      : detail ? [{ mainId: detail.item_main_id, name: detail.item_name, imageUrl: detail.item_image_url, quantity: 1, unitAmountMxnCents: detail.amount_mxn_cents }] : undefined;
    return {
      id: order.id, status: order.status, createdAt: order.created_at, updatedAt: order.updated_at, paidAt: order.paid_at,
      deliveredAt: order.delivered_at, amountMxnCents: order.amount_mxn_cents, recipientId: order.epic_account_id,
      receiptAt: detail?.transfer_receipts?.map((receipt) => receipt.created_at).sort().at(-1) ?? null,
      items: lines,
    };
  });

  return NextResponse.json({
    overview: buildOperationsOverview({ orders: overviewOrders, validations: validations.map(toValidation), now, days }),
    store: { activeCarts: activeCarts.count ?? 0, abandonedCarts: abandonedCarts.count ?? 0, favorites: favorites.count ?? 0 },
    deliveryMode: process.env.FULFILLMENT_MODE === "fnshop" ? "automatic" : "manual",
  });
}
