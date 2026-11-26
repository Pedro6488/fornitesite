import { NextResponse } from "next/server";
import { summarizeOwnApi, type FnShopCallRow, type OwnCallRow } from "@/features/admin/application/own-api-summary";
import { authorizeStaff } from "@/shared/server/authorize-staff";
import { fnShopConfigFromEnv } from "@/shared/infrastructure/fnshop/fnshop-client";
import { ownApiConfigFromEnv } from "@/shared/infrastructure/fnshop/own-api-router";

const DAYS = 30;
const MAX_ROWS = 5000;

/** Por qué la tienda no está llamando a nuestra API en este entorno. */
function inactiveReason(): string {
  const fnshop = fnShopConfigFromEnv();
  if (!fnshop.liveAllowed) return "Solo producción llama a nuestra API (usa cuentas de Epic reales). Aquí la tienda no la llama.";
  if (!process.env.OWN_API_BASE_URL?.trim() || !process.env.OWN_API_KEY?.trim()) return "Faltan OWN_API_BASE_URL u OWN_API_KEY en Vercel (producción).";
  return "Nuestra API está apagada en este entorno.";
}

function connection() {
  const config = ownApiConfigFromEnv(process.env, fnShopConfigFromEnv());
  if (!config) return { active: false as const, reason: inactiveReason() };
  return {
    active: true as const,
    host: new URL(config.baseUrl).host,
    gifts: config.gifts,
    primary: config.primary,
    shadow: config.shadow,
    timeoutMs: config.timeoutMs,
  };
}

/**
 * Nuestra API (epic-gifting) vista desde la tienda: qué le preguntamos, qué contestó, cuánto
 * tardó y cuántas veces hubo que ir a FN Shop. Todo sale de `provider_api_calls`: abrir esta
 * pantalla no llama a nadie.
 */
export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const now = new Date();
  const since = new Date(now.getTime() - DAYS * 86_400_000).toISOString();
  const database = staff.database;

  const [own, fnshop, recent] = await Promise.all([
    database.from("provider_api_calls").select("created_at,action,code,result,decision,duration_ms,error,http_status")
      .eq("provider", "own").gte("created_at", since).order("created_at", { ascending: false }).limit(MAX_ROWS).returns<OwnCallRow[]>(),
    database.from("provider_api_calls").select("created_at,action")
      .eq("provider", "fnshop").eq("simulated", false).gte("created_at", since).order("created_at", { ascending: false }).limit(MAX_ROWS).returns<FnShopCallRow[]>(),
    database.from("provider_api_calls")
      .select("id,created_at,action,code,result,decision,duration_ms,trigger,order_id,validation_id,error,http_status")
      .eq("provider", "own").order("created_at", { ascending: false }).limit(100),
  ]);
  if (own.error || fnshop.error) return NextResponse.json({ error: "No fue posible leer la bitácora." }, { status: 503 });

  return NextResponse.json({
    connection: connection(),
    days: DAYS,
    summary: summarizeOwnApi({ own: own.data ?? [], fnshop: fnshop.data ?? [], now, days: DAYS }),
    recent: recent.data ?? [],
  });
}

/** «Probar conexión»: `verify_license` en nuestra API. No cuenta en nada y no toca Epic. */
export async function POST(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const config = ownApiConfigFromEnv(process.env, fnShopConfigFromEnv());
  if (!config) return NextResponse.json({ error: inactiveReason() }, { status: 409 });
  const started = Date.now();
  try {
    const response = await fetch(`${config.baseUrl}/verify_license`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "X-Api-Key": config.apiKey },
      body: new URLSearchParams({ svr: fnShopConfigFromEnv().domain }).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { result?: boolean; code?: string; plan?: string } | null;
    return NextResponse.json({ ok: body?.result === true, code: body?.code ?? `HTTP ${response.status}`, plan: body?.plan ?? null, ms: Date.now() - started });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError" ? "No respondió en 10 s." : error instanceof Error ? error.message : "Error de red.";
    return NextResponse.json({ ok: false, code: null, plan: null, ms: Date.now() - started, error: message });
  }
}
