import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaffWithReason } from "@/shared/server/authorize-staff";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { groupCatalogByCollaboration } from "@/features/catalog/application/catalog-query";

const schema = z.object({ collection: z.string().trim().min(1).max(200), mxnPerHundred: z.number().positive().max(99999999.99).multipleOf(.01), active: z.boolean() }).strict();
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const staff = await authorizeStaffWithReason(request);
  if (!staff.ok) return NextResponse.json({ error: "Acceso exclusivo de administrador." }, { status: staff.status, headers });
  const { data, error } = await staff.database.from("collection_price_rules").select("collection,mxn_per_hundred,active,updated_at").order("collection");
  const missing = error && ["42P01", "PGRST205"].includes(error.code);
  if (error && !missing) return NextResponse.json({ error: "No fue posible consultar las tarifas de colecci?n." }, { status: 503, headers });
  try {
    const items = await (await getCatalogService()).list();
    const groups = groupCatalogByCollaboration(items);
    return NextResponse.json({ configured: !missing, sections: groups.map((group) => ({ name: group.name, count: group.items.length })), rules: data ?? [] }, { headers });
  } catch {
    return NextResponse.json({ error: "No fue posible consultar los apartados del catálogo." }, { status: 503, headers });
  }
}

export async function PUT(request: Request) {
  const staff = await authorizeStaffWithReason(request);
  if (!staff.ok) return NextResponse.json({ error: "Acceso exclusivo de administrador." }, { status: staff.status, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Elige una colección y una tarifa positiva en MXN por cada 100 paVos, con hasta dos decimales." }, { status: 400, headers });
  const { collection, mxnPerHundred, active } = parsed.data;
  // Activar solo apartados vigentes. Se permite desactivar una regla aunque ya saliera de tienda.
  if (active) {
    try {
      const groups = groupCatalogByCollaboration(await (await getCatalogService()).list());
      if (!groups.some((group) => group.name === collection)) return NextResponse.json({ error: "Ese apartado ya no está en el catálogo actual." }, { status: 409, headers });
    } catch { return NextResponse.json({ error: "No fue posible validar el catálogo. No se guardó la tarifa." }, { status: 503, headers }); }
  }
  const { error } = await staff.database.from("collection_price_rules").upsert({ collection, mxn_per_hundred: mxnPerHundred, active, updated_by: staff.user.id, updated_at: new Date().toISOString() }, { onConflict: "collection" });
  if (error) return NextResponse.json({ error: ["42P01", "PGRST205"].includes(error.code) ? "Falta aplicar la migración de tarifas por colección." : "No fue posible guardar la tarifa." }, { status: 503, headers });
  return NextResponse.json({ ok: true }, { headers });
}
