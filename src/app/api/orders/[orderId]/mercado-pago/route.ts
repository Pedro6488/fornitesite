import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Mercado Pago no está disponible. El único método habilitado es transferencia bancaria." }, { status: 410 });
}
