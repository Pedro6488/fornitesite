import { NextResponse } from "next/server";
import { z } from "zod";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

const schema = z.object({
  customerEmail: z.email(), receiverId: z.string().min(3).max(128), platform: z.enum(["epic", "xbox", "playstation", "nintendo"]), whatsapp: z.string().min(8).max(24),
  items: z.array(z.object({ itemMainId: z.string().min(1), quantity: z.literal(1) })).min(1).max(30)
}).refine((value) => new Set(value.items.map((item) => item.itemMainId)).size === value.items.length, { message: "Cada objeto sólo puede solicitarse una vez." });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Cada objeto sólo puede solicitarse una vez. Revisa los datos de tu solicitud." }, { status: 400 });
  const database = getSupabaseAdmin();
  if (!database) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });

  const catalog = await getCatalogService();
  const resolved = await Promise.all(parsed.data.items.map(async (line) => ({ line, item: await catalog.find(line.itemMainId) })));
  if (resolved.some(({ item }) => !item || item.priceMxn === null)) return NextResponse.json({ error: "Uno de los objetos ya no está disponible." }, { status: 409 });

  const total = resolved.reduce((sum, { item }) => sum + item!.priceMxn! * 100, 0);
  const first = resolved[0].item!;
  const { data: order, error } = await database.from("orders").insert({ status: "draft", supervisor_status: "pending_confirmation", customer_email: parsed.data.customerEmail, epic_account_id: parsed.data.receiverId, epic_display_name: parsed.data.receiverId, recipient_platform: parsed.data.platform, contact_whatsapp: parsed.data.whatsapp, item_main_id: first.mainId, offer_id: first.offerId ?? first.mainId, item_name: first.name, item_image_url: first.imageUrl, vbucks_price: first.finalPriceVbucks, amount_mxn_cents: total, payment_method: "bank_transfer" }).select("id,public_token").single();
  if (error || !order) return NextResponse.json({ error: "No fue posible guardar el pedido." }, { status: 503 });

  const { error: itemError } = await database.from("order_items").insert(resolved.map(({ item }) => ({ order_id: order.id, item_main_id: item!.mainId, offer_id: item!.offerId ?? item!.mainId, item_name: item!.name, item_image_url: item!.imageUrl, vbucks_price: item!.finalPriceVbucks, unit_amount_mxn_cents: item!.priceMxn! * 100, quantity: 1 })));
  if (itemError) return NextResponse.json({ error: "El pedido fue creado, pero no se pudieron guardar sus artículos." }, { status: 503 });
  return NextResponse.json({ order: { id: order.id, publicToken: order.public_token } }, { status: 201 });
}
