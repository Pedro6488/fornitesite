import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/shared/server/authorize-staff";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const url = new URL(request.url);
  const from = dateSchema.safeParse(url.searchParams.get("from") || undefined);
  const to = dateSchema.safeParse(url.searchParams.get("to") || undefined);
  if (!from.success || !to.success) return NextResponse.json({ error: "El rango de fechas no es válido." }, { status: 400 });

  let query = staff.database
    .from("orders")
    .select("id,created_at,customer_email,epic_display_name,epic_account_id,recipient_platform,contact_whatsapp,amount_mxn_cents,status,order_items(item_main_id,item_name,item_image_url,vbucks_price,quantity,unit_amount_mxn_cents),transfer_receipts(id,storage_path,mime_type,created_at)")
    .order("created_at", { ascending: false });
  if (from.data) query = query.gte("created_at", `${from.data}T00:00:00-06:00`);
  if (to.data) {
    const nextDay = new Date(`${to.data}T00:00:00-06:00`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    query = query.lt("created_at", nextDay.toISOString());
  }
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: "No fue posible consultar pedidos." }, { status: 503 });

  const orderIds = (data ?? []).map((order) => order.id);
  const auditResult = orderIds.length
    ? await staff.database.from("audit_log").select("entity_id,action,before_data,after_data,created_at").eq("entity_type", "order").in("entity_id", orderIds).order("created_at", { ascending: false }).limit(2000)
    : { data: [], error: null };
  const auditByOrder = new Map<string, typeof auditResult.data>();
  for (const event of auditResult.data ?? []) {
    const current = auditByOrder.get(event.entity_id) ?? [];
    current.push(event);
    auditByOrder.set(event.entity_id, current);
  }

  const orders = await Promise.all((data ?? []).map(async (order) => {
    const ticket = order.transfer_receipts?.toSorted((left, right) => right.created_at.localeCompare(left.created_at))[0];
    const signedTicket = ticket
      ? await staff.database.storage.from("transfer-receipts").createSignedUrl(ticket.storage_path, 10 * 60)
      : null;
    return { ...order, paymentTicketUrl: signedTicket?.data?.signedUrl ?? null, history: auditByOrder.get(order.id) ?? [] };
  }));

  return NextResponse.json({ orders });
}
