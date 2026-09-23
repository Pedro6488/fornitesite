import { NextResponse } from "next/server";
import { z } from "zod";
import { CreateOrder } from "@/features/orders/application/create-order";
import { SupabaseOrderRepository } from "@/features/orders/infrastructure/supabase-order-repository";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

const schema = z.object({ itemMainId: z.string().min(1), customerEmail: z.email(), epicAccountId: z.string().min(3).max(128), epicDisplayName: z.string().min(3).max(32), paymentMethod: z.enum(["mercado_pago", "bank_transfer"]) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Los datos del pedido no son válidos." }, { status: 400 });
  const database = getSupabaseAdmin(); if (!database) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  try {
    const repository = new SupabaseOrderRepository(database);
    let order = await new CreateOrder(await getCatalogService(), repository).execute(parsed.data);
    if (order.paymentMethod === "bank_transfer") {
      await repository.transition(order.id, "draft", "awaiting_transfer");
      order = (await repository.findById(order.id)) ?? order;
    }
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) { console.error("order.create.failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible crear el pedido." }, { status: 409 }); }
}
