import { NextResponse } from "next/server";
import { authorizeStaff } from "@/shared/server/authorize-staff";
import { automaticDeliveryEnabled, getFnShopClient } from "@/features/fnshop/server/get-fnshop-client";
import { budgetLevel } from "@/shared/infrastructure/fnshop/fnshop-budget";
import { fnShopAvailable, fnShopConfigFromEnv } from "@/shared/infrastructure/fnshop/fnshop-client";

type UsageRow = { day: string; action: string; calls: number; counted: number; simulated: number };
type ContractRow = { action: string; code: string; result: boolean | null; simulated: boolean; calls: number; last_seen: string; response_fields: string[] | null };

/**
 * Cuota, consumo y bitácora de FN Shop. Todo sale de `provider_api_calls`:
 * abrir esta pantalla cuesta 0 requests.
 */
export async function GET(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const config = fnShopConfigFromEnv();
  const since = config.termStartsAt.toISOString();
  const database = staff.database;

  const [summary, daily, recent, contract] = await Promise.all([
    database.rpc("fnshop_usage_summary", { p_since: since }),
    database.from("fnshop_usage_daily").select("day,action,calls,counted,simulated").gte("day", since.slice(0, 10)).order("day").returns<UsageRow[]>(),
    database.from("provider_api_calls")
      .select("id,created_at,action,code,result,decision,duration_ms,trigger,order_id,validation_id,simulated,counted,error,http_status")
      .order("created_at", { ascending: false }).limit(100),
    database.from("fnshop_contract_catalog").select("action,code,result,simulated,calls,last_seen,response_fields").order("action").returns<ContractRow[]>(),
  ]);
  if (summary.error) return NextResponse.json({ error: "Falta aplicar las migraciones de FN Shop en esta base." }, { status: 503 });

  const row = (Array.isArray(summary.data) ? summary.data[0] : summary.data) as { counted_total?: number | string; counted_today?: number | string; last_call_at?: string | null } | null;
  const used = Number(row?.counted_total ?? 0);
  const today = Number(row?.counted_today ?? 0);
  const elapsedDays = Math.max(1, (Date.now() - config.termStartsAt.getTime()) / 86_400_000);
  const pace = used / elapsedDays;
  const remaining = Math.max(0, config.monthlyLimit - used);

  const byAction = new Map<string, { action: string; calls: number; counted: number }>();
  const byDay = new Map<string, { day: string; counted: number; calls: number }>();
  for (const entry of daily.data ?? []) {
    const action = byAction.get(entry.action) ?? { action: entry.action, calls: 0, counted: 0 };
    action.calls += Number(entry.calls); action.counted += Number(entry.counted);
    byAction.set(entry.action, action);
    const day = byDay.get(entry.day) ?? { day: entry.day, counted: 0, calls: 0 };
    day.counted += Number(entry.counted); day.calls += Number(entry.calls);
    byDay.set(entry.day, day);
  }

  return NextResponse.json({
    mode: automaticDeliveryEnabled() ? "automatic" : "manual",
    available: automaticDeliveryEnabled() && fnShopAvailable(config),
    simulated: config.simulate,
    live: config.liveAllowed && Boolean(config.apiKey),
    category: config.category,
    term: { startsAt: since, monthlyLimit: config.monthlyLimit, dailyLimit: config.dailyLimit },
    usage: {
      used, today, remaining, level: budgetLevel({ used, today }, config),
      pacePerDay: Math.round(pace * 10) / 10,
      exhaustsInDays: pace > 0 ? Math.floor(remaining / pace) : null,
      lastCallAt: row?.last_call_at ?? null,
    },
    byAction: [...byAction.values()].sort((left, right) => right.counted - left.counted || right.calls - left.calls),
    byDay: [...byDay.values()],
    recent: recent.data ?? [],
    contract: contract.data ?? [],
  });
}

/** «Verificar key»: `verify_license` nunca cuenta contra la cuota. */
export async function POST(request: Request) {
  const staff = await authorizeStaff(request);
  if (!staff) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const client = getFnShopClient(staff.database);
  if (!client) return NextResponse.json({ error: "FN Shop no está disponible en este entorno (falta modo automático, key de producción o simulador)." }, { status: 409 });
  try {
    const response = await client.call("verify_license", {}, { trigger: "admin", actorId: staff.user.id });
    const ok = response.result !== false;
    await client.decide(response.callId, ok ? "license_ok" : "license_failed");
    return NextResponse.json({ ok, simulated: response.simulated, plan: response.body.plan ?? null, code: response.code });
  } catch (error) {
    console.error("admin.fnshop.verify.failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible verificar la key." }, { status: 503 });
  }
}
