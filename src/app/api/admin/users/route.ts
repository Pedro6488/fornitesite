import { NextResponse } from "next/server";
import { authorizeStaffWithReason } from "@/shared/server/authorize-staff";

export async function GET(request: Request) {
  const staff = await authorizeStaffWithReason(request);
  const headers = { "Cache-Control": "private, no-store" };
  if (!staff.ok) return NextResponse.json({ error: "Acceso exclusivo de administrador." }, { status: staff.status, headers });
  const value = new URL(request.url).searchParams.get("page") ?? "1";
  if (!/^[1-9]\d{0,5}$/.test(value)) return NextResponse.json({ error: "Página inválida." }, { status: 400, headers });
  const page = Number(value);
  const { data, error } = await staff.database.auth.admin.listUsers({ page, perPage: 50 });
  if (error) return NextResponse.json({ error: "No fue posible consultar las cuentas registradas." }, { status: 503, headers });
  return NextResponse.json({
    page, nextPage: data.users.length === 50 ? page + 1 : null,
    users: data.users.map((user) => {
      const synthetic = user.email?.endsWith("@accounts.sigfriedlootbox.local");
      return {
        id: user.id,
        login: synthetic ? user.email!.split("@")[0] : user.email ?? user.phone ?? "Sin identificador",
        type: synthetic ? "Usuario" : user.email ? "Correo" : "Teléfono",
        createdAt: user.created_at, lastSignInAt: user.last_sign_in_at ?? null,
      };
    }),
  }, { headers });
}
