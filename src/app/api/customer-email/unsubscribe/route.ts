import { NextResponse } from "next/server";
import { isValidUnsubscribeSignature } from "@/features/notifications/server/providers";
import { requireCommerceSession } from "@/shared/server/commerce-session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const contactId = url.searchParams.get("contact");
  const signature = url.searchParams.get("signature");
  if (!contactId || !signature || !isValidUnsubscribeSignature(contactId, signature)) return NextResponse.redirect(new URL("/carrito?email=invalid", url.origin));
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.redirect(new URL("/carrito?email=unavailable", url.origin));
  await context.database.from("email_contacts").update({ marketing_consent: false, unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", contactId);
  return NextResponse.redirect(new URL("/carrito?email=unsubscribed", url.origin));
}
