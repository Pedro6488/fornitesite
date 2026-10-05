import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    error: "Este flujo fue retirado. Valida tu ID y confirma una cotización desde el carrito."
  }, { status: 410 });
}
