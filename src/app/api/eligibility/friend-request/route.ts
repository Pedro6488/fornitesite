import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentProvider } from "@/features/eligibility/server/get-agent-provider";

const schema = z.object({ epicAccountId: z.string().min(3).max(128) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Epic Account ID inválido." }, { status: 400 });
  try { return NextResponse.json(await getAgentProvider().addFriend(parsed.data.epicAccountId)); }
  catch (error) { console.error("friend.add.failed", error); return NextResponse.json({ error: "No fue posible enviar la solicitud." }, { status: 503 }); }
}
