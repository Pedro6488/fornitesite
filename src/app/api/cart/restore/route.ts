import { NextResponse } from "next/server";
import { canPurchase } from "@/features/catalog/domain/catalog-item";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { hashAutomationToken } from "@/features/notifications/server/providers";
import { attachCommerceCookie, ensureActiveCart, requireCommerceSession } from "@/shared/server/commerce-session";
import { recordCartActivity } from "@/features/notifications/server/campaigns";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const context = await requireCommerceSession(request);
  if (!token || !context) return NextResponse.redirect(new URL("/carrito?restore=invalid", url.origin));
  const { data: record } = await context.database.from("cart_recovery_tokens")
    .select("id,cart_id,expires_at,used_at").eq("token_hash", hashAutomationToken(token))
    .maybeSingle<{ id: string; cart_id: string; expires_at: string; used_at: string | null }>();
  if (!record || record.used_at || new Date(record.expires_at).getTime() < Date.now()) return attachCommerceCookie(NextResponse.redirect(new URL("/carrito?restore=expired", url.origin)), context.session);
  const { data: items } = await context.database.from("shopping_cart_items").select("item_main_id").eq("cart_id", record.cart_id);
  const catalog = await (await getCatalogService()).list();
  const availableIds = (items ?? []).map((item) => item.item_main_id).filter((id) => {
    const item = catalog.find((candidate) => candidate.mainId === id);
    return item && canPurchase(item);
  });
  if (availableIds.length) {
    const targetCartId = await ensureActiveCart(context.database, context.session.id);
    const { error } = await context.database.from("shopping_cart_items").upsert(availableIds.map((itemMainId) => ({ cart_id: targetCartId, item_main_id: itemMainId, quantity: 1 })), { onConflict: "cart_id,item_main_id", ignoreDuplicates: true });
    if (error) return attachCommerceCookie(NextResponse.redirect(new URL("/carrito?restore=failed", url.origin)), context.session);
    const { data: campaign } = await context.database.from("cart_recovery_campaigns").select("contact_id").eq("cart_id", record.cart_id).maybeSingle<{ contact_id: string }>();
    if (campaign?.contact_id) await context.database.from("commerce_sessions").update({ email_contact_id: campaign.contact_id }).eq("id", context.session.id);
    const { data: restored } = await context.database.from("shopping_carts").select("updated_at").eq("id", targetCartId).maybeSingle<{ updated_at: string }>();
    if (restored) await recordCartActivity(context.database, context.session.id, targetCartId, restored.updated_at);
  }
  await context.database.from("cart_recovery_tokens").update({ used_at: new Date().toISOString() }).eq("id", record.id).is("used_at", null);
  return attachCommerceCookie(NextResponse.redirect(new URL(`/carrito?restore=${availableIds.length ? "ok" : "unavailable"}`, url.origin)), context.session);
}
