import { NextResponse } from "next/server";
import { z } from "zod";
import { attachCommerceCookie, requireCommerceSession } from "@/shared/server/commerce-session";

const schema = z.object({ validationId: z.uuid() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "La identidad seleccionada no es válida." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "Supabase todavía no está configurado." }, { status: 503 });

  const { data: validation } = await context.database.from("game_id_validations")
    .select("id").eq("id", parsed.data.validationId).eq("commerce_session_id", context.session.id).maybeSingle();
  if (!validation) return attachCommerceCookie(NextResponse.json({ error: "Este ID no pertenece a tu sesión." }, { status: 404 }), context.session);

  const { error } = await context.database.from("commerce_sessions")
    .update({ active_game_id_validation_id: validation.id, last_seen_at: new Date().toISOString() })
    .eq("id", context.session.id);
  if (error) return attachCommerceCookie(NextResponse.json({ error: "No fue posible seleccionar este ID." }, { status: 503 }), context.session);
  return attachCommerceCookie(NextResponse.json({ ok: true, activeValidationId: validation.id }), context.session);
}
