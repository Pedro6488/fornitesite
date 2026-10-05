import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/shared/server/authorize-staff";

const createSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rule"), minVbucks: z.number().int().positive(), maxVbucks: z.number().int().positive().nullable(), mxnPerHundred: z.number().positive(), effectiveFrom: z.iso.datetime().optional(), effectiveUntil: z.iso.datetime().nullable().optional() }),
  z.object({ type: z.literal("override"), itemMainId: z.string().min(1), amountMxnCents: z.number().int().positive(), effectiveFrom: z.iso.datetime().optional(), effectiveUntil: z.iso.datetime().nullable().optional() })
]).refine((value) => value.type !== "rule" || value.maxVbucks === null || value.maxVbucks >= value.minVbucks, "El rango no es válido.")
  .refine((value) => !value.effectiveUntil || !value.effectiveFrom || new Date(value.effectiveUntil) > new Date(value.effectiveFrom), "La vigencia no es válida.");
const updateSchema = z.object({ type: z.enum(["rule", "override"]), id: z.uuid(), active: z.boolean() });

export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const [rules, overrides] = await Promise.all([
    staff.database.from("price_rules").select("*").order("min_vbucks"),
    staff.database.from("offer_price_overrides").select("*").order("created_at", { ascending: false }).limit(200)
  ]);
  if (rules.error || overrides.error) return NextResponse.json({ error: "No fue posible consultar precios." }, { status: 503 });
  return NextResponse.json({ rules: rules.data, overrides: overrides.data });
}

export async function POST(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Los datos del precio no son válidos." }, { status: 400 });
  const now = parsed.data.effectiveFrom ?? new Date().toISOString();
  const result = parsed.data.type === "rule"
    ? await staff.database.from("price_rules").insert({ min_vbucks: parsed.data.minVbucks, max_vbucks: parsed.data.maxVbucks, mxn_per_hundred: parsed.data.mxnPerHundred, effective_from: now, effective_until: parsed.data.effectiveUntil ?? null, active: true }).select().single()
    : await staff.database.from("offer_price_overrides").insert({ main_id: parsed.data.itemMainId, amount_mxn_cents: parsed.data.amountMxnCents, effective_from: now, effective_until: parsed.data.effectiveUntil ?? null, active: true, created_by: staff.user.id }).select().single();
  if (result.error) return NextResponse.json({ error: result.error.message.includes("overlap") ? "La regla se cruza con otra regla activa." : "No fue posible guardar el precio." }, { status: 409 });
  await staff.database.from("audit_log").insert({ actor_id: staff.user.id, action: "price.create", entity_type: parsed.data.type, entity_id: result.data.id, after_data: result.data });
  return NextResponse.json({ item: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Actualización inválida." }, { status: 400 });
  const table = parsed.data.type === "rule" ? "price_rules" : "offer_price_overrides";
  const { data: before } = await staff.database.from(table).select("*").eq("id", parsed.data.id).maybeSingle();
  const { data, error } = await staff.database.from(table).update({ active: parsed.data.active }).eq("id", parsed.data.id).select().single();
  if (error) return NextResponse.json({ error: error.message.includes("overlap") ? "No puedes activar una regla que se cruza con otra." : "No fue posible actualizar el precio." }, { status: 409 });
  await staff.database.from("audit_log").insert({ actor_id: staff.user.id, action: "price.toggle", entity_type: parsed.data.type, entity_id: parsed.data.id, before_data: before, after_data: data });
  return NextResponse.json({ item: data });
}
