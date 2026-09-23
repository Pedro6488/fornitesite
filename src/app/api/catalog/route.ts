import { NextResponse } from "next/server";
import { getCatalogService } from "@/features/catalog/server/get-catalog";

export async function GET() {
  try {
    const catalog = await getCatalogService();
    return NextResponse.json({ data: await catalog.list() });
  } catch (error) {
    console.error("catalog.list.failed", error);
    return NextResponse.json({ error: "No fue posible cargar el catálogo." }, { status: 503 });
  }
}
