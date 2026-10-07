import { NextResponse } from "next/server";
import { authorizeStaff } from "@/shared/server/authorize-staff";

export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await staff.database.from("game_id_validations")
    .select("id,platform,submitted_id,epic_account_id,display_name,status,giftable_at,last_checked_at,created_at,user_id,reviewed_at,review_note,commerce_session_id")
    .order("last_checked_at", { ascending: false }).limit(250);
  if (error) return NextResponse.json({ error: "No fue posible consultar los IDs." }, { status: 503 });
  const validationIds = (data ?? []).map((entry) => entry.id);
  const { data: orders } = validationIds.length
    ? await staff.database.from("orders").select("id,recipient_validation_id,status,created_at,item_name").in("recipient_validation_id", validationIds).order("created_at", { ascending: false })
    : { data: [] as { id: string; recipient_validation_id: string; status: string; created_at: string; item_name: string }[] };
  const ordersByValidation = new Map<string, typeof orders>();
  for (const order of orders ?? []) ordersByValidation.set(order.recipient_validation_id, [...(ordersByValidation.get(order.recipient_validation_id) ?? []), order]);
  return NextResponse.json({ validations: (data ?? []).map((entry) => ({ ...entry, orders: ordersByValidation.get(entry.id) ?? [] })) });
}
