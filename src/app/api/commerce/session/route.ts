import { NextResponse } from "next/server";
import { z } from "zod";
import {
  attachCommerceCookie,
  commerceErrorResponse,
  ensureActiveCart,
  requireCommerceSession,
} from "@/shared/server/commerce-session";

const schema = z.object({
  cartItemIds: z.array(z.string().min(1).max(180)).max(30).default([]),
  favoriteItemIds: z.array(z.string().min(1).max(180)).max(200).default([]),
});

async function sessionResponse(request: Request, migrateLegacyState: boolean) {
  try {
    const payload = migrateLegacyState ? await request.json().catch(() => ({})) : {};
    const parsed = schema.safeParse(payload);
    if (!parsed.success)
      return NextResponse.json(
        { error: "No fue posible migrar el estado local." },
        { status: 400 },
      );
    const context = await requireCommerceSession(request);
    if (!context)
      return NextResponse.json(
        { error: "La configuración de compra aún no está completa." },
        { status: 503 },
      );
    const { database, session } = context;

    if (new URL(request.url).searchParams.get("advanceIdentity") === "1") {
      const { error } = await database.rpc("advance_delivery_identity_waits", { p_session_id: session.id });
      if (error) throw error;
    }

    const { data: existingCart } = await database
      .from("shopping_carts")
      .select("id")
      .eq("commerce_session_id", session.id)
      .eq("status", "active")
      .maybeSingle<{ id: string }>();
    let cartId = existingCart?.id ?? null;
    if (parsed.data.cartItemIds.length) {
      cartId ??= await ensureActiveCart(database, session.id);
      const { error } = await database.from("shopping_cart_items").upsert(
        [...new Set(parsed.data.cartItemIds)].map((itemMainId) => ({
          cart_id: cartId,
          item_main_id: itemMainId,
          quantity: 1,
        })),
        { onConflict: "cart_id,item_main_id", ignoreDuplicates: true },
      );
      if (error)
        return attachCommerceCookie(
          NextResponse.json(
            { error: "No fue posible migrar el carrito." },
            { status: 503 },
          ),
          session,
        );
    }
    if (parsed.data.favoriteItemIds.length) {
      const { error } = await database.from("customer_favorites").upsert(
        [...new Set(parsed.data.favoriteItemIds)].map((itemMainId) => ({
          commerce_session_id: session.id,
          item_main_id: itemMainId,
        })),
        {
          onConflict: "commerce_session_id,item_main_id",
          ignoreDuplicates: true,
        },
      );
      if (error)
        return attachCommerceCookie(
          NextResponse.json(
            { error: "No fue posible migrar favoritos." },
            { status: 503 },
          ),
          session,
        );
    }

    const [
      { data: cartItems },
      { data: favorites },
      { data: validations },
      { data: sessionState },
    ] = await Promise.all([
      cartId
        ? database
          .from("shopping_cart_items")
          .select("item_main_id")
          .eq("cart_id", cartId)
          .order("added_at")
        : Promise.resolve({ data: [] as { item_main_id: string }[] }),
      database
        .from("customer_favorites")
        .select("item_main_id")
        .eq("commerce_session_id", session.id)
        .order("created_at"),
      database
        .from("game_id_validations")
        .select(
          "id,platform,submitted_id,epic_account_id,display_name,status,giftable_at,last_checked_at",
        )
        .eq("commerce_session_id", session.id)
        .order("last_checked_at", { ascending: false }),
      database
        .from("commerce_sessions")
        .select("active_game_id_validation_id")
        .eq("id", session.id)
        .maybeSingle(),
    ]);
    const activeValidationId =
      sessionState?.active_game_id_validation_id ??
      validations?.[0]?.id ??
      null;
    return attachCommerceCookie(
      NextResponse.json({
        cartItemIds: (cartItems ?? []).map((item) => item.item_main_id),
        favoriteItemIds: (favorites ?? []).map((item) => item.item_main_id),
        validations: validations ?? [],
        activeValidationId,
        authenticated: Boolean(session.user),
      }),
      session,
    );
  } catch (error) {
    return commerceErrorResponse(error, "session");
  }
}

export async function GET(request: Request) {
  return sessionResponse(request, false);
}

export async function POST(request: Request) {
  return sessionResponse(request, true);
}
