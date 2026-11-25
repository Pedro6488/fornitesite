import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { authorizeStaff } from "@/shared/server/authorize-staff";

export const runtime = "nodejs";

/** Observación puntual: no identifica todas las IP de salida ni garantiza la ruta a FN Shop. */
export async function POST(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const headers = { "Cache-Control": "private, no-store" };
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ error: "Consulta esta IP desde el despliegue de producción en Vercel." }, { status: 409, headers });
  }
  try {
    // Solo se transmite la conexión del servidor; nunca credenciales ni datos del pedido.
    const response = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store", signal: AbortSignal.timeout(8_000), redirect: "error",
    });
    if (!response.ok) throw new Error("IP lookup failed");
    const body: unknown = await response.json();
    const ip = body && typeof body === "object" && "ip" in body ? body.ip : null;
    if (typeof ip !== "string" || !isIP(ip)) throw new Error("Invalid IP response");
    return NextResponse.json({ ip, observedAt: new Date().toISOString(), region: process.env.VERCEL_REGION ?? null }, { headers });
  } catch {
    return NextResponse.json({ error: "No fue posible consultar la IP de salida. Intenta de nuevo." }, { status: 503, headers });
  }
}
