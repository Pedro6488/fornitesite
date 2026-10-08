import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";
import { getRequestUser } from "./request-user";

export const COMMERCE_COOKIE = "slb_commerce";
const MAX_AGE = 60 * 60 * 24 * 30;

export class CommerceConfigurationError extends Error {}

export function commerceErrorResponse(error: unknown, operation: string): NextResponse {
  console.error(`commerce.${operation}.failed`, error);
  const configurationFailure = error instanceof CommerceConfigurationError;
  return NextResponse.json({
    error: configurationFailure
      ? "La configuración de compra aún no está completa. Intenta de nuevo más tarde."
      : "No fue posible conectar con el servicio de compra. Intenta de nuevo."
  }, { status: configurationFailure ? 503 : 500 });
}

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
    throw new CommerceConfigurationError("COMMERCE_SESSION_SECRET es obligatorio en producción.");
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
    .select("id,user_id,merged_into")
    .eq("anonymous_token_hash", hash)
    .maybeSingle<{ id: string; user_id: string | null; merged_into: string | null }>();

  // Never let a session already linked to one account cross an auth boundary.
  // This protects shared browsers after sign-out and when another user signs in.
  let existing = foundSession;
  if (existing?.user_id && existing.user_id !== user?.id) {
    token = randomBytes(32).toString("hex");
    hash = tokenHash(token);
    existing = null;
  }

  // Old devices may still carry the token of a session that was merged after
  // login. Always operate on its canonical session to avoid recreating carts.
  let id = existing?.merged_into ?? existing?.id;
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
    const { error } = await database.from("customer_favorites").upsert(
      sourceFavorites.map((favorite) => ({ commerce_session_id: currentSessionId, item_main_id: favorite.item_main_id })),
      { onConflict: "commerce_session_id,item_main_id", ignoreDuplicates: true }
    );
    if (error) throw error;
    await database.from("customer_favorites").delete().in("commerce_session_id", sourceIds);
  }

  const { data: sourceCarts } = await database.from("shopping_carts").select("id").in("commerce_session_id", sourceIds).eq("status", "active");
  const sourceCartIds = (sourceCarts ?? []).map((cart) => cart.id as string);
  if (sourceCartIds.length) {
    const { data: sourceItems } = await database.from("shopping_cart_items").select("item_main_id").in("cart_id", sourceCartIds);
    if (sourceItems?.length) {
      const currentCartId = await ensureActiveCart(database, currentSessionId);
      const { error } = await database.from("shopping_cart_items").upsert(
        sourceItems.map((item) => ({ cart_id: currentCartId, item_main_id: item.item_main_id, quantity: 1 })),
        { onConflict: "cart_id,item_main_id", ignoreDuplicates: true }
      );
      if (error) throw error;
      await database.from("shopping_carts").update({ status: "abandoned", updated_at: new Date().toISOString() }).in("id", sourceCartIds);
    } else {
      await database.from("shopping_carts").delete().in("id", sourceCartIds);
    }
  }

  await database.from("orders").update({ user_id: userId }).in("commerce_session_id", [currentSessionId, ...sourceIds]).is("user_id", null);
  type ValidationMergeRow = { id: string; commerce_session_id: string; epic_account_id: string; platform: string; submitted_id: string; display_name: string; status: string; giftable_at: string | null; provider: string; agents_snapshot: unknown; reviewed_at: string | null; review_note: string | null; last_checked_at: string };
  const { data: validationRows } = await database.from("game_id_validations")
    .select("id,commerce_session_id,epic_account_id,platform,submitted_id,display_name,status,giftable_at,provider,agents_snapshot,reviewed_at,review_note,last_checked_at")
    .in("commerce_session_id", [currentSessionId, ...sourceIds]) as { data: ValidationMergeRow[] | null };
  const rank: Record<string, number> = { pending_friendship: 1, manual_review: 2, waiting: 3, ready: 4, blocked: 5 };
  const targets = new Map<string, ValidationMergeRow>();
  for (const validation of validationRows?.filter((entry) => entry.commerce_session_id === currentSessionId) ?? []) targets.set(validation.epic_account_id, validation);
  for (const source of validationRows?.filter((entry) => sourceIds.includes(entry.commerce_session_id)) ?? []) {
    const target = targets.get(source.epic_account_id);
    if (!target) {
      const { data: copied, error } = await database.from("game_id_validations").insert({
        commerce_session_id: currentSessionId,
        user_id: userId,
        platform: source.platform,
        submitted_id: source.submitted_id,
        epic_account_id: source.epic_account_id,
        display_name: source.display_name,
        status: source.status,
        giftable_at: source.giftable_at,
        provider: source.provider,
        agents_snapshot: source.agents_snapshot,
        reviewed_at: source.reviewed_at,
        review_note: source.review_note,
        last_checked_at: source.last_checked_at
      }).select("id,commerce_session_id,epic_account_id,platform,submitted_id,display_name,status,giftable_at,provider,agents_snapshot,reviewed_at,review_note,last_checked_at").single<ValidationMergeRow>();
      if (error) throw error;
      if (copied) targets.set(copied.epic_account_id, copied);
      continue;
    }
    if ((rank[source.status] ?? 0) > (rank[target.status] ?? 0)) {
      const { error } = await database.from("game_id_validations").update({ status: source.status, giftable_at: source.giftable_at, reviewed_at: source.reviewed_at, review_note: source.review_note, last_checked_at: source.last_checked_at }).eq("id", target.id);
      if (error) throw error;
      target.status = source.status; target.giftable_at = source.giftable_at; target.last_checked_at = source.last_checked_at;
    }
  }
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
