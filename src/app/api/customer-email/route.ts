import { NextResponse } from "next/server";
import { z } from "zod";
import { attachCommerceCookie, requireCommerceSession } from "@/shared/server/commerce-session";
import { deliverOutboxJob, hashAutomationToken, sendVerificationEmail } from "@/features/notifications/server/providers";
import { queueOutboxJob } from "@/features/notifications/server/outbox";

const inputSchema = z.object({ email: z.email().max(254), consent: z.boolean() });
type Contact = { id: string; email: string; email_normalized: string; marketing_consent: boolean; verified_at: string | null; unsubscribed_at: string | null; welcome_sent_at: string | null };

async function attachContactToActiveCart(database: NonNullable<Awaited<ReturnType<typeof requireCommerceSession>>>["database"], sessionId: string, contactId: string) {
  const { data: cart } = await database.from("shopping_carts").select("id,updated_at,shopping_cart_items(id)")
    .eq("commerce_session_id", sessionId).eq("status", "active").maybeSingle<{ id: string; updated_at: string; shopping_cart_items: { id: string }[] }>();
  if (!cart?.shopping_cart_items?.length) return;
  const { error } = await database.from("cart_recovery_campaigns").upsert({
    cart_id: cart.id, contact_id: contactId, last_activity_at: cart.updated_at, canceled_at: null, updated_at: new Date().toISOString(),
  }, { onConflict: "cart_id" });
  if (error) throw error;
}

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
  const context = await requireCommerceSession(request);
  if (!context) return NextResponse.json({ error: "La configuración de compra aún no está completa." }, { status: 503 });
  const email = parsed.data.email.trim();
  const emailNormalized = email.toLowerCase();
  try {
    const { data: current } = await context.database.from("email_contacts").select("id,email,email_normalized,marketing_consent,verified_at,unsubscribed_at,welcome_sent_at")
      .eq("commerce_session_id", context.session.id).eq("email_normalized", emailNormalized).maybeSingle<Contact>();
    let contact = current;
    if (contact) {
      const { data, error } = await context.database.from("email_contacts").update({
        email, marketing_consent: parsed.data.consent && !contact.unsubscribed_at, user_id: context.session.user?.id ?? null,
        unsubscribed_at: contact.unsubscribed_at,
        updated_at: new Date().toISOString(),
      }).eq("id", contact.id).select("id,email,email_normalized,marketing_consent,verified_at,unsubscribed_at,welcome_sent_at").single<Contact>();
      if (error) throw error;
      contact = data;
    } else {
      const { data, error } = await context.database.from("email_contacts").insert({
        commerce_session_id: context.session.id, email, email_normalized: emailNormalized, user_id: context.session.user?.id ?? null, marketing_consent: parsed.data.consent,
      }).select("id,email,email_normalized,marketing_consent,verified_at,unsubscribed_at,welcome_sent_at").single<Contact>();
      if (error || !data) throw error ?? new Error("No fue posible guardar el correo.");
      contact = data;
    }
    const { error: sessionError } = await context.database.from("commerce_sessions").update({ email_contact_id: contact.id }).eq("id", context.session.id);
    if (sessionError) throw sessionError;
    await attachContactToActiveCart(context.database, context.session.id, contact.id);
    if (contact.marketing_consent && !contact.verified_at) await sendVerificationEmail(context.database, contact);
    return attachCommerceCookie(NextResponse.json({
      verified: Boolean(contact.verified_at), verificationSent: contact.marketing_consent && !contact.verified_at,
      message: contact.unsubscribed_at ? "Ese correo se dio de baja de recordatorios." : contact.verified_at ? "Tu correo ya está verificado." : parsed.data.consent ? "Revisa tu correo para confirmarlo." : "Correo guardado sin recordatorios.",
    }), context.session);
  } catch (error) {
    console.error("customer-email.save.failed", error);
    return attachCommerceCookie(NextResponse.json({ error: "No fue posible guardar el correo." }, { status: 503 }), context.session);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const context = await requireCommerceSession(request);
  if (!context) return token ? NextResponse.redirect(new URL("/carrito?email=unavailable", url.origin)) : NextResponse.json({ contact: null }, { status: 503 });
  if (!token) {
    const { data: session } = await context.database.from("commerce_sessions").select("email_contact_id").eq("id", context.session.id).maybeSingle<{ email_contact_id: string | null }>();
    if (!session?.email_contact_id) return attachCommerceCookie(NextResponse.json({ contact: null }), context.session);
    const { data: contact } = await context.database.from("email_contacts").select("email,verified_at,marketing_consent,unsubscribed_at").eq("id", session.email_contact_id)
      .maybeSingle<{ email: string; verified_at: string | null; marketing_consent: boolean; unsubscribed_at: string | null }>();
    return attachCommerceCookie(NextResponse.json({ contact: contact ?? null }), context.session);
  }
  if (token.length < 32) return attachCommerceCookie(NextResponse.redirect(new URL("/carrito?email=invalid", url.origin)), context.session);
  const { data: record } = await context.database.from("email_verification_tokens")
    .select("id,contact_id,expires_at,used_at").eq("token_hash", hashAutomationToken(token))
    .maybeSingle<{ id: string; contact_id: string; expires_at: string; used_at: string | null }>();
  if (!record || record.used_at || new Date(record.expires_at).getTime() < Date.now()) return attachCommerceCookie(NextResponse.redirect(new URL("/carrito?email=expired", url.origin)), context.session);
  const now = new Date().toISOString();
  const { error: tokenError } = await context.database.from("email_verification_tokens").update({ used_at: now }).eq("id", record.id).is("used_at", null);
  if (tokenError) return attachCommerceCookie(NextResponse.redirect(new URL("/carrito?email=invalid", url.origin)), context.session);
  const { data: contact, error: contactError } = await context.database.from("email_contacts")
    .update({ verified_at: now, unsubscribed_at: null, updated_at: now }).eq("id", record.contact_id)
    .select("id,email,marketing_consent").single<{ id: string; email: string; marketing_consent: boolean }>();
  if (contactError || !contact) return attachCommerceCookie(NextResponse.redirect(new URL("/carrito?email=invalid", url.origin)), context.session);
  await context.database.from("commerce_sessions").update({ email_contact_id: contact.id }).eq("id", context.session.id);
  if (contact.marketing_consent) {
    const job = await queueOutboxJob(context.database, { jobType: "email.welcome", aggregateId: contact.id, payload: { contactId: contact.id }, dedupeKey: `email:welcome:${contact.id}` });
    try { await deliverOutboxJob(context.database, job); }
    catch (deliveryError) { console.error("email.welcome.immediate.failed", deliveryError); }
  }
  return attachCommerceCookie(NextResponse.redirect(new URL("/carrito?email=verified", url.origin)), context.session);
}
