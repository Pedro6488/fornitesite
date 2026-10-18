import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaffWithReason } from "@/shared/server/authorize-staff";

const schema = z.object({ status: z.enum(["waiting", "ready", "blocked"]), notes: z.string().trim().max(500).optional() })
  .refine((value) => value.status !== "blocked" || Boolean(value.notes && value.notes.length >= 3), { message: "Indica el motivo del bloqueo.", path: ["notes"] });

type ValidationState = {
  status: "pending_friendship" | "waiting" | "ready" | "manual_review" | "blocked";
  giftable_at: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ validationId: string }> }) {
  const staff = await authorizeStaffWithReason(request);
  if (!staff.ok) {
    const error = staff.status === 403 ? "Tu cuenta no tiene permisos de administrador." : staff.status === 503 ? "La administración no está configurada." : "La sesión no es válida.";
    return NextResponse.json({ error }, { status: staff.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisión inválida." }, { status: 400 });
  const { validationId } = await params;
  const validId = z.string().uuid().safeParse(validationId);
  if (!validId.success) return NextResponse.json({ error: "El ID de validación no es válido." }, { status: 400 });

  const { data: validation, error: lookupError } = await staff.database
    .from("game_id_validations")
    .select("status,giftable_at")
    .eq("id", validationId)
    .maybeSingle<ValidationState>();
  if (lookupError) return NextResponse.json({ error: "No fue posible consultar el ID." }, { status: 503 });
  if (!validation) return NextResponse.json({ error: "El ID ya no existe." }, { status: 404 });

  const target = parsed.data.status;
  const sameState = target === validation.status;
  const override = target === "ready" && (
    validation.status === "manual_review" ||
    (validation.status === "waiting" && (!validation.giftable_at || new Date(validation.giftable_at).getTime() > Date.now()))
  );
  const allowed = sameState ||
    (target === "waiting" && ["manual_review", "pending_friendship"].includes(validation.status)) ||
    (target === "ready" && ["manual_review", "waiting"].includes(validation.status)) ||
    (target === "blocked" && ["manual_review", "pending_friendship", "waiting", "ready"].includes(validation.status));
  if (!allowed) return NextResponse.json({ error: "La transición solicitada no está permitida." }, { status: 409 });
  if (override && (!parsed.data.notes || parsed.data.notes.length < 10)) {
    return NextResponse.json({ error: "Indica un motivo de al menos 10 caracteres para autorizar la excepción." }, { status: 400 });
  }

  const { data, error } = await staff.database.rpc("review_game_id_validation", {
    p_validation_id: validationId,
    p_status: parsed.data.status,
    p_actor_id: staff.user.id,
    p_note: parsed.data.notes ?? null
  });
  if (error) {
    if (error.message.includes("override_reason_required") || error.message.includes("block_reason_required")) {
      return NextResponse.json({ error: "El motivo indicado no cumple los requisitos." }, { status: 400 });
    }
    if (error.message.includes("admin_actor_required")) {
      return NextResponse.json({ error: "Tu cuenta no tiene permisos de administrador." }, { status: 403 });
    }
    if (error.message.includes("invalid_validation_transition") || error.message.includes("invalid_validation_review_status")) {
      return NextResponse.json({ error: "La transición solicitada no está permitida." }, { status: 409 });
    }
    return NextResponse.json({ error: "No fue posible guardar la revisión." }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: "El ID ya no existe." }, { status: 404 });
  return NextResponse.json({ ok: true, override });
}
