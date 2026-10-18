import { NextResponse } from "next/server";
import { z } from "zod";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { resolveCartAvailability } from "@/features/cart/application/cart-availability";
import { attachCommerceCookie, commerceErrorResponse, requireCommerceSession } from "@/shared/server/commerce-session";
import { recordCartActivity } from "@/features/notifications/server/campaigns";

const schema = z.object({ itemIds: z.array(z.string().min(1).max(180)).max(30) })
  .refine((value) => new Set(value.itemIds).size === value.itemIds.length, "No se permiten artículos duplicados.");

export async function GET(request: Request) {
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  const { data: cart } = await context.database.from("shopping_carts").select("id").eq("commerce_session_id", context.session.id).eq("status", "active").maybeSingle<{ id: string }>();
  if (!cart) return attachCommerceCookie(NextResponse.json({ itemIds: [] }), context.session);
  const cartId = cart.id;
  const { data, error } = await context.database.from("shopping_cart_items").select("item_main_id").eq("cart_id", cartId).order("added_at");
  const response = error
    ? NextResponse.json({ error: "No fue posible consultar el carrito." }, { status: 503 })
    : NextResponse.json({ itemIds: (data ?? []).map((item) => item.item_main_id) });
  return attachCommerceCookie(response, context.session);
}

export async function PUT(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "El carrito no es válido." }, { status: 400 });
    const context = await requireCommerceSession(request);
    if (!context) return NextResponse.json({ error: "La configuración de compra aún no está completa." }, { status: 503 });
    if (parsed.data.itemIds.length === 0) {
      const { error } = await context.database.from("shopping_carts").delete().eq("commerce_session_id", context.session.id).eq("status", "active");
      if (error) return attachCommerceCookie(NextResponse.json({ error: "No fue posible vaciar el carrito." }, { status: 503 }), context.session);
      return attachCommerceCookie(NextResponse.json({ itemIds: [] }), context.session);
    }
    const catalogItems = await (await getCatalogService()).list();
    const availability = resolveCartAvailability(parsed.data.itemIds, catalogItems);
    const availableItemIds = availability.filter((entry) => entry.available).map((entry) => entry.itemId);
    const removedItemIds = availability.filter((entry) => !entry.available).map((entry) => entry.itemId);
    if (availableItemIds.length === 0) {
      const { error } = await context.database.from("shopping_carts").delete().eq("commerce_session_id", context.session.id).eq("status", "active");
      if (error) return attachCommerceCookie(NextResponse.json({ error: "No fue posible limpiar el carrito." }, { status: 503 }), context.session);
      return attachCommerceCookie(NextResponse.json({ itemIds: [], removedItemIds }), context.session);
    }
    const { error } = await context.database.rpc("replace_cart_items", {
      p_session_id: context.session.id,
      p_item_ids: availableItemIds
    });
    if (error) return attachCommerceCookie(NextResponse.json({ error: "No fue posible guardar el carrito." }, { status: 503 }), context.session);
    const { data: savedCart } = await context.database.from("shopping_carts").select("id,updated_at")
      .eq("commerce_session_id", context.session.id).eq("status", "active")
      .maybeSingle<{ id: string; updated_at: string }>();
    if (savedCart) {
      await recordCartActivity(context.database, context.session.id, savedCart.id, savedCart.updated_at);
    }
    return attachCommerceCookie(NextResponse.json({ itemIds: availableItemIds, removedItemIds }), context.session);
  } catch (error) {
    return commerceErrorResponse(error, "cart");
  }
}
