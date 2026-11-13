import { NextResponse } from "next/server";
import { z } from "zod";
import { ORDER_QUEUES, queueOf, statusesOf, type OrderQueueId } from "@/features/admin/application/order-queues";
import type { OrderStatus } from "@/features/orders/domain/order";
import { authorizeStaff } from "@/shared/server/authorize-staff";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const queueSchema = z.enum(["payment", "deliver", "problem", "closed"]);

/** Las colas abiertas se cargan completas; la de cerrados crece sin límite y se carga por partes. */
const CLOSED_PAGE_SIZE = 50;
const CLOSED_MAX = 500;

/**
 * Lista de pedidos de una cola. No firma comprobantes ni trae el historial:
 * eso se pide por pedido en `GET /api/admin/orders/[orderId]`.
 */
export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const url = new URL(request.url);
  const queue = queueSchema.safeParse(url.searchParams.get("queue") ?? "payment");
  const from = dateSchema.safeParse(url.searchParams.get("from") || undefined);
  const to = dateSchema.safeParse(url.searchParams.get("to") || undefined);
  const limit = Math.min(CLOSED_MAX, Math.max(CLOSED_PAGE_SIZE, Number(url.searchParams.get("limit") ?? CLOSED_PAGE_SIZE) || CLOSED_PAGE_SIZE));
  if (!queue.success || !from.success || !to.success) return NextResponse.json({ error: "El filtro de pedidos no es válido." }, { status: 400 });

  const closed = queue.data === "closed";
  let query = staff.database
    .from("orders")
    .select("id,created_at,updated_at,customer_email,epic_display_name,recipient_platform,contact_whatsapp,amount_mxn_cents,currency,amount_usd_cents,status,order_items(item_name,item_image_url,quantity),transfer_receipts(id)")
    .in("status", statusesOf(queue.data))
    // En las colas abiertas va primero lo que lleva más tiempo esperando.
    .order("created_at", { ascending: !closed });
  if (from.data) query = query.gte("created_at", `${from.data}T00:00:00-06:00`);
  if (to.data) {
    const nextDay = new Date(`${to.data}T00:00:00-06:00`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    query = query.lt("created_at", nextDay.toISOString());
  }
  // Se pide una fila de más para saber si quedan pedidos por cargar.
  if (closed) query = query.range(0, limit);

  const [{ data, error }, statuses] = await Promise.all([
    query,
    staff.database.from("orders").select("status").not("status", "in", `(${statusesOf("closed").join(",")})`).limit(5000),
  ]);
  if (error || statuses.error) return NextResponse.json({ error: "No fue posible consultar pedidos." }, { status: 503 });

  const counts = Object.fromEntries(ORDER_QUEUES.map((entry) => [entry.id, 0])) as Record<OrderQueueId, number>;
  for (const row of statuses.data ?? []) counts[queueOf(row.status as OrderStatus)] += 1;

  const rows = closed ? (data ?? []).slice(0, limit) : data ?? [];
  const orders = rows.map(({ transfer_receipts: receipts, ...order }) => ({ ...order, hasReceipt: Boolean(receipts?.length) }));
  return NextResponse.json({ orders, counts, hasMore: closed && (data ?? []).length > limit && limit < CLOSED_MAX });
}
