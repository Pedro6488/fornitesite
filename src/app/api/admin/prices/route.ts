import { NextResponse } from "next/server";
import { z } from "zod";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { authorizeStaff } from "@/shared/server/authorize-staff";

const createSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rule"), minVbucks: z.number().int().positive(), maxVbucks: z.number().int().positive().nullable(), mxnPerHundred: z.number().positive(), effectiveFrom: z.iso.datetime().optional(), effectiveUntil: z.iso.datetime().nullable().optional() }),
  z.object({ type: z.literal("override"), itemMainId: z.string().min(1), amountMxnCents: z.number().int().positive(), effectiveFrom: z.iso.datetime().optional(), effectiveUntil: z.iso.datetime().nullable().optional() })
]).refine((value) => value.type !== "rule" || value.maxVbucks === null || value.maxVbucks >= value.minVbucks, "El rango no es válido.")
  .refine((value) => !value.effectiveUntil || !value.effectiveFrom || new Date(value.effectiveUntil) > new Date(value.effectiveFrom), "La vigencia no es válida.");
const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("toggle"), type: z.enum(["rule", "override"]), id: z.uuid(), active: z.boolean() }),
  z.object({ action: z.literal("editRule"), type: z.literal("rule"), id: z.uuid(), minVbucks: z.number().int().positive(), maxVbucks: z.number().int().positive().nullable(), mxnPerHundred: z.number().positive(), effectiveFrom: z.iso.datetime().optional(), effectiveUntil: z.iso.datetime().nullable().optional() }),
  z.object({ action: z.literal("editOverride"), type: z.literal("override"), id: z.uuid(), amountMxnCents: z.number().int().positive(), effectiveFrom: z.iso.datetime().optional(), effectiveUntil: z.iso.datetime().nullable().optional() })
]).refine((value) => value.action !== "editRule" || value.maxVbucks === null || value.maxVbucks >= value.minVbucks, "El rango no es válido.")
  .refine((value) => value.action === "toggle" || !value.effectiveUntil || !value.effectiveFrom || new Date(value.effectiveUntil) > new Date(value.effectiveFrom), "La vigencia no es válida.");

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
  if (parsed.data.type === "override") {
    const { data: existing, error: existingError } = await staff.database.from("offer_price_overrides").select("id").eq("main_id", parsed.data.itemMainId).maybeSingle();
    if (existingError) return NextResponse.json({ error: "No fue posible comprobar la excepción existente." }, { status: 503 });
    if (existing) return NextResponse.json({ error: "Este objeto ya tiene una excepción. Edita la existente en lugar de crear otra." }, { status: 409 });
    const catalogItem = await (await getCatalogService()).find(parsed.data.itemMainId);
    if (!catalogItem) return NextResponse.json({ error: "El objeto seleccionado ya no está disponible en el catálogo." }, { status: 400 });
    const { error: catalogError } = await staff.database.from("catalog_items").upsert({ main_id: catalogItem.mainId, name: catalogItem.name, description: catalogItem.description, image_url: catalogItem.imageUrl, item_type: catalogItem.type, rarity: catalogItem.rarity, metadata: { collaboration: catalogItem.collaboration ?? null, offerId: catalogItem.offerId, finalPriceVbucks: catalogItem.finalPriceVbucks }, updated_at: new Date().toISOString() }, { onConflict: "main_id" });
    if (catalogError) return NextResponse.json({ error: "No fue posible preparar el objeto seleccionado para su precio especial." }, { status: 503 });
  }
  const result = parsed.data.type === "rule"
    ? await staff.database.from("price_rules").insert({ min_vbucks: parsed.data.minVbucks, max_vbucks: parsed.data.maxVbucks, mxn_per_hundred: parsed.data.mxnPerHundred, effective_from: now, effective_until: parsed.data.effectiveUntil ?? null, active: true }).select().single()
    : await staff.database.from("offer_price_overrides").insert({ main_id: parsed.data.itemMainId, amount_mxn_cents: parsed.data.amountMxnCents, effective_from: now, effective_until: parsed.data.effectiveUntil ?? null, active: true, created_by: staff.user.id }).select().single();
  if (result.error) return NextResponse.json({ error: result.error.message.includes("overlap") ? "Ya existe una regla activa para ese rango y esa vigencia. Desactívala o elige una vigencia que no se cruce." : result.error.message.includes("duplicate") ? "Este objeto ya tiene una excepción. Edita la existente." : result.error.message.includes("foreign key") ? "El objeto seleccionado no pudo vincularse al catálogo interno." : "No fue posible guardar el precio." }, { status: 409 });
  await staff.database.from("audit_log").insert({ actor_id: staff.user.id, action: "price.create", entity_type: parsed.data.type, entity_id: result.data.id, after_data: result.data });
  return NextResponse.json({ item: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Actualización inválida." }, { status: 400 });
  if (parsed.data.action === "editRule") {
    const { data: before } = await staff.database.from("price_rules").select("*").eq("id", parsed.data.id).maybeSingle();
    if (!before) return NextResponse.json({ error: "No encontramos la regla a editar." }, { status: 404 });
    const { data, error } = await staff.database.from("price_rules").update({ min_vbucks: parsed.data.minVbucks, max_vbucks: parsed.data.maxVbucks, mxn_per_hundred: parsed.data.mxnPerHundred, effective_from: parsed.data.effectiveFrom ?? new Date().toISOString(), effective_until: parsed.data.effectiveUntil ?? null }).eq("id", parsed.data.id).select().single();
    if (error) return NextResponse.json({ error: error.message.includes("overlap") ? "La edición se cruza con otra regla activa. Ajusta el rango o la vigencia." : "No fue posible editar la regla." }, { status: 409 });
    await staff.database.from("audit_log").insert({ actor_id: staff.user.id, action: "price.update", entity_type: "rule", entity_id: data.id, before_data: before, after_data: data });
    return NextResponse.json({ item: data });
  }
  if (parsed.data.action === "editOverride") {
    const { data: before } = await staff.database.from("offer_price_overrides").select("*").eq("id", parsed.data.id).maybeSingle();
    if (!before) return NextResponse.json({ error: "No encontramos la excepción a editar." }, { status: 404 });
    const { data, error } = await staff.database.from("offer_price_overrides").update({ amount_mxn_cents: parsed.data.amountMxnCents, effective_from: parsed.data.effectiveFrom ?? before.effective_from, effective_until: parsed.data.effectiveUntil ?? null }).eq("id", parsed.data.id).select().single();
    if (error) return NextResponse.json({ error: "No fue posible editar la excepción." }, { status: 409 });
    await staff.database.from("audit_log").insert({ actor_id: staff.user.id, action: "price.update", entity_type: "override", entity_id: data.id, before_data: before, after_data: data });
    return NextResponse.json({ item: data });
  }
  const table = parsed.data.type === "rule" ? "price_rules" : "offer_price_overrides";
  const { data: before } = await staff.database.from(table).select("*").eq("id", parsed.data.id).maybeSingle();
  const { data, error } = await staff.database.from(table).update({ active: parsed.data.active }).eq("id", parsed.data.id).select().single();
  if (error) return NextResponse.json({ error: error.message.includes("overlap") ? "No puedes activar una regla que se cruza con otra." : "No fue posible actualizar el precio." }, { status: 409 });
  await staff.database.from("audit_log").insert({ actor_id: staff.user.id, action: "price.toggle", entity_type: parsed.data.type, entity_id: parsed.data.id, before_data: before, after_data: data });
  return NextResponse.json({ item: data });
}
