import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/shared/server/authorize-staff";

const schema = z.object({ status: z.enum(["waiting", "ready", "blocked"]), notes: z.string().trim().max(500).optional() })
  .refine((value) => value.status !== "blocked" || Boolean(value.notes && value.notes.length >= 3), { message: "Indica el motivo del bloqueo.", path: ["notes"] });

export async function PATCH(request: Request, { params }: { params: Promise<{ validationId: string }> }) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisión inválida." }, { status: 400 });
  const { validationId } = await params;
  const { data, error } = await staff.database.rpc("review_game_id_validation", {
    p_validation_id: validationId,
    p_status: parsed.data.status,
    p_actor_id: staff.user.id,
    p_note: parsed.data.notes ?? null
  });
  if (error) return NextResponse.json({ error: "No fue posible guardar la revisión." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "El ID ya no existe." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
