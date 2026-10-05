import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import { getRequestUser } from "./request-user";

export const COMMERCE_COOKIE = "slb_commerce";
const MAX_AGE = 60 * 60 * 24 * 30;

export type CommerceSession = Readonly<{
  id: string;
  token: string;
  isNew: boolean;
  user: User | null;
}>;

function cookieValue(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COMMERCE_COOKIE) return decodeURIComponent(value.join("="));
  }
  return null;
}

function tokenHash(token: string): string {
  const configuredSecret = process.env.COMMERCE_SESSION_SECRET?.trim();
  if (!configuredSecret && process.env.NODE_ENV === "production") {
    throw new Error("COMMERCE_SESSION_SECRET es obligatorio en producción.");
  }
  const pepper = configuredSecret ?? "local-development-only";
  return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

export async function requireCommerceSession(request: Request): Promise<{
  database: SupabaseClient;
  session: CommerceSession;
} | null> {
  const database = getSupabaseAdmin();
  if (!database) return null;

  const existingToken = cookieValue(request);
  let token = existingToken && /^[a-f0-9]{64}$/i.test(existingToken)
    ? existingToken
    : randomBytes(32).toString("hex");
  let hash = tokenHash(token);
  const user = await getRequestUser(request, database);
  const { data: foundSession } = await database
    .from("commerce_sessions")
    .select("id,user_id")
    .eq("anonymous_token_hash", hash)
    .maybeSingle<{ id: string; user_id: string | null }>();

  // Never let a session already linked to one account cross an auth boundary.
  // This protects shared browsers after sign-out and when another user signs in.
  let existing = foundSession;
  if (existing?.user_id && existing.user_id !== user?.id) {
    token = randomBytes(32).toString("hex");
    hash = tokenHash(token);
    existing = null;
  }

  let id = existing?.id;
  if (!id) {
    const { data, error } = await database
      .from("commerce_sessions")
      .insert({ anonymous_token_hash: hash, user_id: user?.id ?? null })
      .select("id")
      .single<{ id: string }>();
    if (error || !data) throw error ?? new Error("No fue posible crear la sesión comercial.");
    id = data.id;
  } else {
    await database.from("commerce_sessions").update({
      last_seen_at: new Date().toISOString(),
      ...(user && !existing?.user_id ? { user_id: user.id } : {})
    }).eq("id", id);
  }

  if (user) await mergeUserCommerce(database, id, user.id);
  return { database, session: { id, token, isNew: token !== existingToken, user } };
}

async function mergeUserCommerce(database: SupabaseClient, currentSessionId: string, userId: string) {
  const { data: sessions } = await database
    .from("commerce_sessions")
    .select("id")
    .eq("user_id", userId)
    .neq("id", currentSessionId)
    .is("merged_into", null);
  const sourceIds = (sessions ?? []).map((session) => session.id as string);
  if (!sourceIds.length) {
    await database.from("orders").update({ user_id: userId }).eq("commerce_session_id", currentSessionId).is("user_id", null);
    await database.from("game_id_validations").update({ user_id: userId }).eq("commerce_session_id", currentSessionId).is("user_id", null);
    return;
  }

  const { data: sourceFavorites } = await database.from("customer_favorites").select("item_main_id").in("commerce_session_id", sourceIds);
  if (sourceFavorites?.length) {
    await database.from("customer_favorites").upsert(
      sourceFavorites.map((favorite) => ({ commerce_session_id: currentSessionId, item_main_id: favorite.item_main_id })),
      { onConflict: "commerce_session_id,item_main_id", ignoreDuplicates: true }
    );
  }

  const currentCartId = await ensureActiveCart(database, currentSessionId);
  const { data: sourceCarts } = await database.from("shopping_carts").select("id").in("commerce_session_id", sourceIds).eq("status", "active");
  const sourceCartIds = (sourceCarts ?? []).map((cart) => cart.id as string);
  if (sourceCartIds.length) {
    const { data: sourceItems } = await database.from("shopping_cart_items").select("item_main_id").in("cart_id", sourceCartIds);
    if (sourceItems?.length) {
      await database.from("shopping_cart_items").upsert(
        sourceItems.map((item) => ({ cart_id: currentCartId, item_main_id: item.item_main_id, quantity: 1 })),
        { onConflict: "cart_id,item_main_id", ignoreDuplicates: true }
      );
    }
    await database.from("shopping_carts").update({ status: "abandoned", updated_at: new Date().toISOString() }).in("id", sourceCartIds);
  }

  await database.from("orders").update({ user_id: userId }).in("commerce_session_id", [currentSessionId, ...sourceIds]).is("user_id", null);
  await database.from("game_id_validations").update({ user_id: userId, commerce_session_id: currentSessionId }).in("commerce_session_id", sourceIds);
  await database.from("game_id_validations").update({ user_id: userId }).eq("commerce_session_id", currentSessionId).is("user_id", null);
  const { data: activeValidation } = await database.from("game_id_validations")
    .select("id").eq("commerce_session_id", currentSessionId)
    .order("last_checked_at", { ascending: false }).limit(1).maybeSingle<{ id: string }>();
  if (activeValidation) {
    await database.from("commerce_sessions").update({ active_game_id_validation_id: activeValidation.id }).eq("id", currentSessionId);
  }
  await database.from("commerce_sessions").update({ merged_into: currentSessionId }).in("id", sourceIds);
}

export async function ensureActiveCart(database: SupabaseClient, sessionId: string): Promise<string> {
  const { data: existing } = await database.from("shopping_carts").select("id").eq("commerce_session_id", sessionId).eq("status", "active").maybeSingle<{ id: string }>();
  if (existing) return existing.id;
  const { data, error } = await database.from("shopping_carts").insert({
    commerce_session_id: sessionId,
    status: "active",
    converted_order_id: null,
    updated_at: new Date().toISOString()
  }).select("id").single<{ id: string }>();
  if (error || !data) throw error ?? new Error("No fue posible crear el carrito.");
  return data.id;
}

export function attachCommerceCookie(response: NextResponse, session: CommerceSession): NextResponse {
  response.cookies.set(COMMERCE_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE
  });
  return response;
}
