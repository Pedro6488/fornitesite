import { NextResponse } from "next/server";
import { authorizeStaff } from "@/shared/server/authorize-staff";

export async function GET(request: Request) {
  const staff = await authorizeStaff(request); if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data: orders, error } = await staff.database.from("orders").select("id,item_name,epic_display_name,amount_mxn_cents,status,created_at").in("status", ["transfer_review", "information_required"]).order("created_at");
  if (error) return NextResponse.json({ error: "No fue posible consultar transferencias." }, { status: 503 });
  const result = await Promise.all((orders ?? []).map(async (order) => {
    const { data: receipt } = await staff.database.from("transfer_receipts").select("id,storage_path,sender_bank,sender_name,transfer_reference,created_at").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const signed = receipt ? await staff.database.storage.from("transfer-receipts").createSignedUrl(receipt.storage_path, 300) : null;
    return { ...order, receipt: receipt ? { ...receipt, signedUrl: signed?.data?.signedUrl ?? null } : null };
  }));
  return NextResponse.json({ transfers: result });
}
