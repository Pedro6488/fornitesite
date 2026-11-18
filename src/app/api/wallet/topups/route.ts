import { NextResponse } from "next/server";
import { z } from "zod";
import { walletContext } from "@/features/wallet/server/context";
import { consumeCommerceRateLimit } from "@/shared/server/commerce-rate-limit";
const schema = z.object({ region: z.enum(["mx","us"]), vbucks: z.number().int().min(100).max(50000).multipleOf(100), expectedCents: z.number().int().positive(), key: z.uuid() });
export async function POST(request: Request) {
  const ctx = await walletContext(request);
  if (!ctx) return NextResponse.json({ error: "Inicia sesión para comprar pavos." }, { status: 401 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Revisa la cantidad de pavos." }, { status: 400 });
  if (!await consumeCommerceRateLimit(ctx.database, ctx.user.id, "wallet.topup", 15, 600)) return NextResponse.json({ error: "Espera unos minutos antes de solicitar otra recarga." }, { status: 429 });
  const { data, error } = await ctx.database.rpc("create_wallet_topup", { p_user: ctx.user.id, p_region: body.data.region, p_vbucks: body.data.vbucks, p_expected_cents: body.data.expectedCents, p_key: body.data.key });
  if (error) return NextResponse.json({ error: /rate_changed/.test(error.message) ? "La tarifa cambió. Actualiza antes de continuar." : /rate_disabled/.test(error.message) ? "Las recargas aún no tienen una tarifa activa." : "No fue posible crear la recarga." }, { status: 409 });
  return NextResponse.json({ topup: data }, { status: 201 });
}
