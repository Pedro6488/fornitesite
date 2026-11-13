import { NextResponse } from "next/server";
import { z } from "zod";
import { getFnShopClient } from "@/features/fnshop/server/get-fnshop-client";
import { authorizeStaff } from "@/shared/server/authorize-staff";
import { DeliveryError } from "../application/deliver-order";
import { SupabaseDeliveryStore } from "../infrastructure/supabase-delivery-store";
import type { FnShopClient } from "@/shared/infrastructure/fnshop/fnshop-client";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type DeliveryContext = { orderId: string; user: User; database: SupabaseClient; store: SupabaseDeliveryStore; fnshop: FnShopClient };

/** Rutas de entrega: solo staff, solo con entrega automática, y errores explicados en español. */
export async function withDeliveryContext(
  request: Request,
  params: Promise<{ orderId: string }>,
  handler: (context: DeliveryContext) => Promise<unknown>,
) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  const fnshop = getFnShopClient(staff.database);
  if (!fnshop) {
    return NextResponse.json({ error: "La entrega automática no está activa en este entorno. Envía el regalo a mano y márcalo como entregado." }, { status: 409 });
  }
  try {
    const body = await handler({ orderId, user: staff.user, database: staff.database, store: new SupabaseDeliveryStore(staff.database), fnshop });
    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof DeliveryError) return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    console.error("admin.delivery.failed", { orderId, error });
    return NextResponse.json({ error: "No fue posible completar la operación. Revisa el pedido antes de reintentar." }, { status: 503 });
  }
}
