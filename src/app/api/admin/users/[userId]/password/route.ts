import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaffWithReason } from "@/shared/server/authorize-staff";

const schema = z.object({ password: z.string().min(8).max(72) }).strict();

export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  const staff = await authorizeStaffWithReason(request);
  const headers = { "Cache-Control": "private, no-store" };
  if (!staff.ok) return NextResponse.json({ error: "Acceso exclusivo de administrador." }, { status: staff.status, headers });
  const { userId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(userId).success || !parsed.success) {
    return NextResponse.json({ error: "Selecciona una cuenta válida y una contraseña de 8 a 72 caracteres." }, { status: 400, headers });
  }
  const { data: target, error: targetError } = await staff.database.auth.admin.getUserById(userId);
  if (targetError || !target.user) return NextResponse.json({ error: "No fue posible encontrar la cuenta." }, { status: 404, headers });
  // La bitácora conserva actor y cuenta; nunca contraseñas ni atributos de autenticación.
  const { error: auditError } = await staff.database.from("audit_log").insert({
    actor_id: staff.user.id, action: "user.password_change_requested", entity_type: "user", entity_id: userId,
  });
  if (auditError) return NextResponse.json({ error: "No fue posible registrar la operación. La contraseña no cambió." }, { status: 503, headers });
  const { error } = await staff.database.auth.admin.updateUserById(userId, { password: parsed.data.password });
  if (error) return NextResponse.json({ error: "No se cambió la contraseña. Comprueba que cumpla la política de seguridad de la cuenta e intenta de nuevo." }, { status: 400, headers });
  const { error: resultAuditError } = await staff.database.from("audit_log").insert({
    actor_id: staff.user.id, action: "user.password_changed", entity_type: "user", entity_id: userId,
  });
  return NextResponse.json({ ok: true, warning: resultAuditError ? "La contraseña cambió, pero no se pudo registrar la confirmación en la bitácora." : null }, { headers });
}
