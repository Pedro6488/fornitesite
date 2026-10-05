import { NextResponse } from "next/server";
import { z } from "zod";
import { canPurchase } from "@/features/catalog/domain/catalog-item";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { attachCommerceCookie, ensureActiveCart, requireCommerceSession } from "@/shared/server/commerce-session";

const schema = z.object({ itemIds: z.array(z.string().min(1).max(180)).max(30) })
  .refine((value) => new Set(value.itemIds).size === value.itemIds.length, "No se permiten artículos duplicados.");

export async function GET(request: Request) {
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  const cartId = await ensureActiveCart(context.database, context.session.id);
  const { data, error } = await context.database.from("shopping_cart_items").select("item_main_id").eq("cart_id", cartId).order("added_at");
  const response = error
    ? NextResponse.json({ error: "No fue posible consultar el carrito." }, { status: 503 })
    : NextResponse.json({ itemIds: (data ?? []).map((item) => item.item_main_id) });
  return attachCommerceCookie(response, context.session);
}

export async function PUT(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "El carrito no es válido." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  const catalog = await getCatalogService();
  const items = await Promise.all(parsed.data.itemIds.map((id) => catalog.find(id)));
  if (items.some((item) => !item || !canPurchase(item))) {
    return attachCommerceCookie(NextResponse.json({ error: "Uno de los objetos ya no está disponible." }, { status: 409 }), context.session);
  }
  const { error } = await context.database.rpc("replace_cart_items", {
    p_session_id: context.session.id,
    p_item_ids: parsed.data.itemIds
  });
  if (error) return attachCommerceCookie(NextResponse.json({ error: "No fue posible guardar el carrito." }, { status: 503 }), context.session);
  return attachCommerceCookie(NextResponse.json({ itemIds: parsed.data.itemIds }), context.session);
}
