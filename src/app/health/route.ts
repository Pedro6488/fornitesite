import { NextResponse } from "next/server";
import { fnShopAvailable, fnShopConfigFromEnv } from "@/shared/infrastructure/fnshop/fnshop-client";

/**
 * Salud del servicio. Es pública, así que nunca llama a FN Shop: la key se
 * verifica desde la consola («Verificar key», verify_license no gasta cuota).
 */
export function GET() {
  const fulfillmentMode = process.env.FULFILLMENT_MODE ?? "manual";
  const automatic = fulfillmentMode === "fnshop";
  const fnshop = fnShopConfigFromEnv();
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "COMMERCE_SESSION_SECRET", "WHATSAPP_BUSINESS_NUMBER",
    ...(automatic && fnshop.liveAllowed ? ["FNSHOP_API_KEY", "FNSHOP_TERM_STARTS_AT"] : [])
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  const ready = missing.length === 0 && process.env.ALLOW_DEMO_PROVIDERS !== "true";
  return NextResponse.json({
    status: ready ? "ok" : "degraded",
    service: "sigfried-loot-box",
    readiness: ready ? "ready" : "configuration_required",
    missing,
    demoProvidersEnabled: process.env.ALLOW_DEMO_PROVIDERS === "true",
    fulfillmentMode,
    ...(automatic ? { fnshop: { available: fnShopAvailable(fnshop), simulated: fnshop.simulate } } : {})
  }, { status: ready ? 200 : 503 });
}
