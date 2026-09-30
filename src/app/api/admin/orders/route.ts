import { NextResponse } from "next/server";
import { authorizeStaff } from "@/shared/server/authorize-staff";

export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data, error } = await staff.database
    .from("orders")
    .select("id,created_at,customer_email,epic_display_name,epic_account_id,recipient_platform,contact_whatsapp,amount_mxn_cents,supervisor_status,order_items(item_name,quantity),order_payment_tickets(storage_path)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "No fue posible consultar pedidos." }, { status: 503 });

  const orders = await Promise.all((data ?? []).map(async (order) => {
    const ticket = order.order_payment_tickets?.[0];
    const signedTicket = ticket
      ? await staff.database.storage.from("transfer-receipts").createSignedUrl(ticket.storage_path, 10 * 60)
      : null;
    return { ...order, paymentTicketUrl: signedTicket?.data?.signedUrl ?? null };
  }));

  return NextResponse.json({ orders });
}
