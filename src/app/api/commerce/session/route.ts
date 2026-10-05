import { NextResponse } from "next/server";
import { z } from "zod";
import { attachCommerceCookie, ensureActiveCart, requireCommerceSession } from "@/shared/server/commerce-session";

const schema = z.object({
  cartItemIds: z.array(z.string().min(1).max(180)).max(30).default([]),
  favoriteItemIds: z.array(z.string().min(1).max(180)).max(200).default([])
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "No fue posible migrar el estado local." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  const { database, session } = context;

  const cartId = await ensureActiveCart(database, session.id);
  if (parsed.data.cartItemIds.length) {
    const { error } = await database.from("shopping_cart_items").upsert(
      [...new Set(parsed.data.cartItemIds)].map((itemMainId) => ({ cart_id: cartId, item_main_id: itemMainId, quantity: 1 })),
      { onConflict: "cart_id,item_main_id", ignoreDuplicates: true }
    );
    if (error) return attachCommerceCookie(NextResponse.json({ error: "No fue posible migrar el carrito." }, { status: 503 }), session);
  }
  if (parsed.data.favoriteItemIds.length) {
    const { error } = await database.from("customer_favorites").upsert(
      [...new Set(parsed.data.favoriteItemIds)].map((itemMainId) => ({ commerce_session_id: session.id, item_main_id: itemMainId })),
      { onConflict: "commerce_session_id,item_main_id", ignoreDuplicates: true }
    );
    if (error) return attachCommerceCookie(NextResponse.json({ error: "No fue posible migrar favoritos." }, { status: 503 }), session);
  }

  const [{ data: cartItems }, { data: favorites }, { data: validation }] = await Promise.all([
    database.from("shopping_cart_items").select("item_main_id").eq("cart_id", cartId).order("added_at"),
    database.from("customer_favorites").select("item_main_id").eq("commerce_session_id", session.id).order("created_at"),
    database.from("game_id_validations").select("id,platform,submitted_id,epic_account_id,display_name,status,giftable_at,last_checked_at")
      .eq("commerce_session_id", session.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  return attachCommerceCookie(NextResponse.json({
    cartItemIds: (cartItems ?? []).map((item) => item.item_main_id),
    favoriteItemIds: (favorites ?? []).map((item) => item.item_main_id),
    validation: validation ?? null,
    authenticated: Boolean(session.user)
  }), session);
}
