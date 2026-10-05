import { NextResponse } from "next/server";

export function GET() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "COMMERCE_SESSION_SECRET", "FNSHOP_API_KEY", "WHATSAPP_BUSINESS_NUMBER",
    "BANK_NAME", "BANK_BENEFICIARY", "BANK_CLABE"
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  const ready = missing.length === 0 && process.env.ALLOW_DEMO_PROVIDERS !== "true";
  return NextResponse.json({
    status: ready ? "ok" : "degraded",
    service: "sigfried-loot-box",
    readiness: ready ? "ready" : "configuration_required",
    missing,
    demoProvidersEnabled: process.env.ALLOW_DEMO_PROVIDERS === "true"
  }, { status: ready ? 200 : 503 });
}
