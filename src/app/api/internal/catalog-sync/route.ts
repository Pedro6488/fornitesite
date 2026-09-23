import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const database = getSupabaseAdmin(); if (!database) return NextResponse.json({ error: "Supabase no configurado." }, { status: 503 });
  const { data: run } = await database.from("sync_runs").insert({ source: "catalog", status: "running" }).select("id").single();
  try {
    const items = await (await getCatalogService()).list(); const now = new Date().toISOString();
    for (const item of items) {
      await database.from("catalog_items").upsert({ main_id: item.mainId, name: item.name, description: item.description, image_url: item.imageUrl, item_type: item.type, rarity: item.rarity, updated_at: now });
      if (item.offerId) await database.from("shop_offers").upsert({ offer_id: item.offerId, main_id: item.mainId, regular_price_vbucks: item.regularPriceVbucks, final_price_vbucks: item.finalPriceVbucks, giftable: item.giftable, active: true, available_until: item.availableUntil, source_updated_at: now, updated_at: now }, { onConflict: "offer_id,source_updated_at" });
    }
    if (run) await database.from("sync_runs").update({ status: "completed", item_count: items.length, finished_at: now }).eq("id", run.id);
    return NextResponse.json({ synchronized: items.length, at: now });
  } catch (error) {
    if (run) await database.from("sync_runs").update({ status: "failed", error: error instanceof Error ? error.message : "Unknown error", finished_at: new Date().toISOString() }).eq("id", run.id);
    console.error("catalog.sync.failed", error); return NextResponse.json({ error: "Falló la sincronización." }, { status: 503 });
  }
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET; const value = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || !value) return false; const expected = createHash("sha256").update(secret).digest(); const received = createHash("sha256").update(value).digest(); return timingSafeEqual(expected, received);
}
