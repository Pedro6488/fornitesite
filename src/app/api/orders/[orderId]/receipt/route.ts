import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Este endpoint fue reemplazado por payment-ticket." }, { status: 410 });
}
