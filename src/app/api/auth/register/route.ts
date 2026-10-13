import { NextResponse } from "next/server";
import { z } from "zod";
import { attachCommerceCookie, requireCommerceSession } from "@/shared/server/commerce-session";

const ACCOUNT_DOMAIN = "accounts.sigfriedlootbox.local";
const schema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{3,24}$/),
  password: z.string().min(8).max(72)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Usa un nombre de 3 a 24 caracteres: letras, números, guion o guion bajo." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "El acceso todavía no está configurado." }, { status: 503 });
  const email = `${parsed.data.username}@${ACCOUNT_DOMAIN}`;
  const { error } = await context.database.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { username: parsed.data.username, account_type: "username" }
  });
  if (error) {
    const duplicated = /already|registered|exists/i.test(error.message);
    return attachCommerceCookie(NextResponse.json({ error: duplicated ? "Ese nombre de usuario ya está ocupado." : "No fue posible crear la cuenta." }, { status: duplicated ? 409 : 503 }), context.session);
  }
  return attachCommerceCookie(NextResponse.json({ login: email }, { status: 201 }), context.session);
}
