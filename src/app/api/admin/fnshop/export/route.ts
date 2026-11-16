import { NextResponse } from "next/server";
import { authorizeStaff } from "@/shared/server/authorize-staff";
import { fnShopConfigFromEnv } from "@/shared/infrastructure/fnshop/fnshop-client";

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;
const COLUMNS = "id,created_at,environment,simulated,trigger,action,code,result,decision,counted,http_status,duration_ms,error,order_id,order_item_id,validation_id,correlation_id,request_params,response_body";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Exporta la bitácora del periodo (`?format=json` o `csv`) para analizarla fuera
 * o convertirla en casos de prueba de la API propia. Nunca incluye la API key.
 */
export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const since = new URL(request.url).searchParams.get("all") === "1" ? "1970-01-01" : fnShopConfigFromEnv().termStartsAt.toISOString();

  const rows: Record<string, unknown>[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await staff.database.from("provider_api_calls").select(COLUMNS)
      .gte("created_at", since).order("id").range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) return NextResponse.json({ error: "No fue posible leer la bitácora." }, { status: 503 });
    rows.push(...(data ?? []) as Record<string, unknown>[]);
    if ((data ?? []).length < PAGE_SIZE) break;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="fnshop-bitacora-${stamp}.json"`, "Cache-Control": "no-store" },
    });
  }
  const header = COLUMNS.split(",");
  const csv = [header.join(","), ...rows.map((row) => header.map((column) => csvCell(row[column])).join(","))].join("\r\n");
  return new NextResponse(`﻿${csv}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="fnshop-bitacora-${stamp}.csv"`, "Cache-Control": "no-store" },
  });
}
