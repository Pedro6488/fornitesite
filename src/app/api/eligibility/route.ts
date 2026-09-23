import { NextResponse } from "next/server";
import { z } from "zod";
import { CheckEligibility } from "@/features/eligibility/application/check-eligibility";
import { getAgentProvider } from "@/features/eligibility/server/get-agent-provider";

const inputSchema = z.object({ displayName: z.string().trim().min(3).max(32), platform: z.enum(["epic", "psn", "xbl", "nintendo"]), requiredVbucks: z.number().int().positive().max(100_000) });

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Los datos de la cuenta no son válidos." }, { status: 400 });
  try { return NextResponse.json(await new CheckEligibility(getAgentProvider()).execute(parsed.data)); }
  catch (error) { console.error("eligibility.check.failed", error); return NextResponse.json({ error: "No fue posible consultar las cuentas de entrega." }, { status: 503 }); }
}
