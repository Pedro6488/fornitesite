import { NextResponse } from "next/server";
import { z } from "zod";
import { attachCommerceCookie, commerceErrorResponse, requireCommerceSession } from "@/shared/server/commerce-session";

const schema = z.object({ itemMainId: z.string().min(1).max(180) });

export async function GET(request: Request) {
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });
  const { data, error } = await context.database.from("customer_favorites").select("item_main_id")
    .eq("commerce_session_id", context.session.id).order("created_at");
  const response = error
    ? NextResponse.json({ error: "No fue posible consultar favoritos." }, { status: 503 })
    : NextResponse.json({ itemIds: (data ?? []).map((item) => item.item_main_id) });
  return attachCommerceCookie(response, context.session);
}

export async function POST(request: Request) {
  return mutate(request, "add");
}

export async function DELETE(request: Request) {
  return mutate(request, "remove");
}

async function mutate(request: Request, operation: "add" | "remove") {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Favorito inválido." }, { status: 400 });
    const context = await requireCommerceSession(request);
    if (!context) return NextResponse.json({ error: "La configuración de compra aún no está completa." }, { status: 503 });
    const query = operation === "add"
      ? context.database.from("customer_favorites").upsert({ commerce_session_id: context.session.id, item_main_id: parsed.data.itemMainId }, { onConflict: "commerce_session_id,item_main_id" })
      : context.database.from("customer_favorites").delete().eq("commerce_session_id", context.session.id).eq("item_main_id", parsed.data.itemMainId);
    const { error } = await query;
    const response = error
      ? NextResponse.json({ error: "No fue posible actualizar favoritos." }, { status: 503 })
      : NextResponse.json({ ok: true });
    return attachCommerceCookie(response, context.session);
  } catch (error) {
    return commerceErrorResponse(error, "favorites");
  }
}
