import { NextResponse } from "next/server";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params; const access = new URL(request.url).searchParams.get("access"); const database = getSupabaseAdmin();
  if (!database || !access) return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
  const order = await new SupabaseOrderRepository(database).findByPublicToken(orderId, access);
  return order ? NextResponse.json({ order }) : NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
}
