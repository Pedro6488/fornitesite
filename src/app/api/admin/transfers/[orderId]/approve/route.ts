import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Usa la transición auditada del panel de pedidos." }, { status: 410 });
}
