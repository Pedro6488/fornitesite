import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { walletContext } from "@/features/wallet/server/context";
import { consumeCommerceRateLimit } from "@/shared/server/commerce-rate-limit";
const EXPIRED = "Esta recarga venció a las 48 horas. Crea una nueva; si ya pagaste, escríbenos con tu comprobante.";
export async function POST(request: Request, { params }: { params: Promise<{ topupId: string }> }) {
  const ctx = await walletContext(request);
  if (!ctx) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const { topupId } = await params;
  if (!z.uuid().safeParse(topupId).success) return NextResponse.json({ error: "Recarga inválida." }, { status: 400 });
  const { data: topup, error: lookupError } = await ctx.database.from("wallet_topups").select("id,status,expires_at").eq("id", topupId).eq("user_id", ctx.user.id).maybeSingle();
  if (lookupError || !topup) return NextResponse.json({ error: "Recarga no encontrada." }, { status: 404 });
  if (topup.status === "awaiting_payment" && Date.parse(topup.expires_at) <= Date.now()) {
    await ctx.database.from("wallet_topups").update({ status: "expired" }).eq("id", topup.id).eq("status", "awaiting_payment");
    return NextResponse.json({ error: EXPIRED }, { status: 409 });
  }
  if (topup.status === "expired") return NextResponse.json({ error: EXPIRED }, { status: 409 });
  if (topup.status !== "awaiting_payment") return NextResponse.json({ error: "Esta recarga ya tiene un comprobante o fue revisada." }, { status: 409 });
  if (!await consumeCommerceRateLimit(ctx.database, ctx.user.id, "wallet.receipt", 10, 3600)) return NextResponse.json({ error: "Espera antes de enviar otro comprobante." }, { status: 429 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("receipt");
  const ext: Record<string,string> = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
  if (!(file instanceof File) || !file.size || file.size > 5242880 || !ext[file.type]) return NextResponse.json({ error: "Usa JPG, PNG o PDF de máximo 5 MB." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid = file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : file.type === "image/png" ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.subarray(0,5).toString() === "%PDF-";
  if (!valid) return NextResponse.json({ error: "El contenido no coincide con el formato del archivo." }, { status: 400 });
  const path = `${ctx.user.id}/${topup.id}/${crypto.randomUUID()}.${ext[file.type]}`;
  const { error: uploadError } = await ctx.database.storage.from("wallet-receipts").upload(path, bytes, { contentType: file.type });
  if (uploadError) return NextResponse.json({ error: "No fue posible guardar el comprobante." }, { status: 503 });
  const { data, error } = await ctx.database.from("wallet_topups").update({ status: "submitted", receipt_path: path, receipt_checksum: createHash("sha256").update(bytes).digest("hex") }).eq("id", topup.id).eq("user_id", ctx.user.id).eq("status", "awaiting_payment").select("id").maybeSingle();
  if (error || !data) {
    await ctx.database.storage.from("wallet-receipts").remove([path]);
    return NextResponse.json({ error: error?.code === "23505" ? "Este comprobante ya se utilizó en otra recarga." : error?.message?.includes("topup_expired") ? EXPIRED : "La recarga cambió o no pudo guardarse." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
