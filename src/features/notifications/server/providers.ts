import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "@/shared/server/app-url";
import type { OutboxJob } from "./outbox";
import { cancelOutboxJob, markOutboxSent } from "./outbox";
import { getCatalogService } from "@/features/catalog/server/get-catalog";

type Contact = { id: string; email: string; marketing_consent: boolean; verified_at: string | null; unsubscribed_at: string | null; welcome_sent_at: string | null };
type Cart = { id: string; status: string; updated_at: string; commerce_session_id: string };
type TelegramOrder = {
  id: string;
  epic_display_name: string;
  contact_whatsapp: string;
  amount_mxn_cents: number;
  order_items: { item_name: string; quantity: number }[];
};

const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
const appUrl = () => getAppUrl();
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

function telegramButtonUrl(value: string) {
  try {
    const url = new URL(value);
    const localHostnames = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
    return ["http:", "https:"].includes(url.protocol) && !localHostnames.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function sendTelegram(text: string, url: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIds = process.env.TELEGRAM_ADMIN_CHAT_IDS?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  if (!token || !chatIds.length) throw new Error("Telegram no está configurado.");
  const buttonUrl = telegramButtonUrl(url);
  const results = await Promise.all(chatIds.map(async (chatId) => {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(buttonUrl ? { reply_markup: { inline_keyboard: [[{ text: "Abrir en el panel", url: buttonUrl }]] } } : {}),
      }),
    });
    const body = await response.json().catch(() => ({})) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    if (!response.ok || !body.ok) throw new Error(body.description ?? "Telegram rechazó el mensaje.");
    return String(body.result?.message_id ?? "");
  }));
  return results.filter(Boolean).join(",");
}

async function sendEmail(input: { to: string; subject: string; html: string; idempotencyKey: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Resend no está configurado.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });
  const body = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
  if (!response.ok) throw new Error(body.message ?? body.name ?? "Resend rechazó el correo.");
  return body.id ?? null;
}

async function contactForJob(database: SupabaseClient, contactId: string) {
  const { data, error } = await database.from("email_contacts")
    .select("id,email,marketing_consent,verified_at,unsubscribed_at,welcome_sent_at")
    .eq("id", contactId).maybeSingle<Contact>();
  if (error) throw error;
  return data;
}

function unsubscribeUrl(contactId: string) {
  const url = new URL("/api/customer-email/unsubscribe", appUrl());
  url.searchParams.set("contact", contactId);
  url.searchParams.set("signature", signUnsubscribe(contactId));
  return url.toString();
}

function unsubscribeSecret() { return process.env.COMMERCE_SESSION_SECRET?.trim() || "local-development-only"; }
function signUnsubscribe(contactId: string) { return createHmac("sha256", unsubscribeSecret()).update(contactId).digest("hex"); }
export function isValidUnsubscribeSignature(contactId: string, signature: string) {
  const expected = signUnsubscribe(contactId);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function orderItemsText(order: TelegramOrder) {
  return order.order_items.map((item) => `• ${item.item_name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`).join("\n");
}

async function getTelegramOrder(database: SupabaseClient, orderId: string) {
  const { data: order, error } = await database.from("orders")
    .select("id,epic_display_name,contact_whatsapp,amount_mxn_cents,order_items(item_name,quantity)").eq("id", orderId)
    .maybeSingle<TelegramOrder>();
  if (error) throw error;
  return order;
}

async function deliverOrderTelegram(database: SupabaseClient, job: OutboxJob, event: "created" | "receipt") {
  const orderId = String(job.payload.orderId ?? job.aggregate_id ?? "");
  const order = await getTelegramOrder(database, orderId);
  if (!order) return cancelOutboxJob(database, job.id);
  const url = new URL("/admin", appUrl()); url.searchParams.set("tab", "orders"); url.searchParams.set("order", order.id);
  const heading = event === "created" ? "🛒 Nuevo pedido" : "🧾 Comprobante recibido";
  const messageId = await sendTelegram(`${heading} #${order.id.slice(0, 8).toUpperCase()}\n\nObjetos:\n${orderItemsText(order) || "• Sin objetos"}\n\nID de entrega: ${order.epic_display_name}\nTeléfono: ${order.contact_whatsapp}\nTotal: ${(order.amount_mxn_cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}`, url.toString());
  await markOutboxSent(database, job.id, messageId);
}

async function deliverWelcome(database: SupabaseClient, job: OutboxJob) {
  const contactId = String(job.payload.contactId ?? job.aggregate_id ?? "");
  const contact = await contactForJob(database, contactId);
  if (!contact || !contact.marketing_consent || !contact.verified_at || contact.unsubscribed_at || contact.welcome_sent_at) return cancelOutboxJob(database, job.id);
  const messageId = await sendEmail({
    to: contact.email,
    subject: "Bienvenido a SigfriedLootBox",
    idempotencyKey: `welcome:${contact.id}`,
    html: `<h1>¡Bienvenido a SigfriedLootBox!</h1><p>Tu correo fue confirmado. Ya podrás recibir recordatorios de tu carrito cuando tú lo autorices.</p><p><a href="${escapeHtml(appUrl())}">Explorar la tienda</a></p><p><small><a href="${escapeHtml(unsubscribeUrl(contact.id))}">Dejar de recibir recordatorios</a></small></p>`,
  });
  const { error } = await database.from("email_contacts").update({ welcome_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", contact.id);
  if (error) throw error;
  await markOutboxSent(database, job.id, messageId);
}

async function deliverRecovery(database: SupabaseClient, job: OutboxJob) {
  const cartId = String(job.payload.cartId ?? job.aggregate_id ?? "");
  const reminder = Number(job.payload.reminder ?? 1);
  const { data: campaign, error: campaignError } = await database.from("cart_recovery_campaigns")
    .select("cart_id,contact_id,last_activity_at,first_sent_at,second_sent_at,canceled_at").eq("cart_id", cartId)
    .maybeSingle<{ cart_id: string; contact_id: string; last_activity_at: string; first_sent_at: string | null; second_sent_at: string | null; canceled_at: string | null }>();
  if (campaignError) throw campaignError;
  if (!campaign || campaign.canceled_at || (reminder === 1 && campaign.first_sent_at) || (reminder === 2 && campaign.second_sent_at)) return cancelOutboxJob(database, job.id);
  const { data: cart } = await database.from("shopping_carts").select("id,status,updated_at,commerce_session_id").eq("id", cartId).maybeSingle<Cart>();
  const contact = await contactForJob(database, campaign.contact_id);
  if (!cart || cart.status !== "active" || !contact || !contact.verified_at || !contact.marketing_consent || contact.unsubscribed_at) {
    await database.from("cart_recovery_campaigns").update({ canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("cart_id", cartId);
    return cancelOutboxJob(database, job.id);
  }
  const inactiveFor = Date.now() - new Date(cart.updated_at).getTime();
  if (inactiveFor < 24 * 60 * 60_000) return cancelOutboxJob(database, job.id);
  const { data: lines } = await database.from("shopping_cart_items").select("item_main_id").eq("cart_id", cartId);
  if (!lines?.length) return cancelOutboxJob(database, job.id);
  const restoreToken = randomBytes(32).toString("hex");
  const { error: tokenError } = await database.from("cart_recovery_tokens").insert({
    cart_id: cartId, token_hash: tokenHash(restoreToken), expires_at: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
  });
  if (tokenError) throw tokenError;
  const catalog = await (await getCatalogService()).list();
  const names = lines.map((line) => catalog.find((item) => item.mainId === line.item_main_id)?.name ?? line.item_main_id).slice(0, 5);
  const restoreUrl = new URL("/api/cart/restore", appUrl()); restoreUrl.searchParams.set("token", restoreToken);
  const messageId = await sendEmail({
    to: contact.email,
    subject: reminder === 1 ? "Tu carrito sigue guardado" : "Último recordatorio de tu carrito",
    idempotencyKey: `cart-recovery:${cartId}:${reminder}`,
    html: `<h1>${reminder === 1 ? "Tu carrito te espera" : "¿Aún te interesan estos objetos?"}</h1><p>${names.map(escapeHtml).join("<br>")}</p><p><a href="${escapeHtml(restoreUrl.toString())}">Restaurar mi carrito</a></p><p><small><a href="${escapeHtml(unsubscribeUrl(contact.id))}">Dejar de recibir recordatorios</a></small></p>`,
  });
  const field = reminder === 1 ? "first_sent_at" : "second_sent_at";
  const { error: updateError } = await database.from("cart_recovery_campaigns").update({ [field]: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("cart_id", cartId);
  if (updateError) throw updateError;
  await markOutboxSent(database, job.id, messageId);
}

export async function deliverOutboxJob(database: SupabaseClient, job: OutboxJob) {
  if (job.job_type === "telegram.cart.started") return cancelOutboxJob(database, job.id);
  if (job.job_type === "telegram.order.created") return deliverOrderTelegram(database, job, "created");
  if (job.job_type === "telegram.order.receipt_submitted") return deliverOrderTelegram(database, job, "receipt");
  if (job.job_type === "email.welcome") return deliverWelcome(database, job);
  if (job.job_type === "email.cart.recovery") return deliverRecovery(database, job);
  return cancelOutboxJob(database, job.id);
}

export async function sendVerificationEmail(database: SupabaseClient, contact: Contact) {
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  await database.from("email_verification_tokens").delete().eq("contact_id", contact.id).is("used_at", null);
  const { error } = await database.from("email_verification_tokens").insert({ contact_id: contact.id, token_hash: tokenHash(rawToken), expires_at: expiresAt });
  if (error) throw error;
  const verifyUrl = new URL("/api/customer-email/verify", appUrl()); verifyUrl.searchParams.set("token", rawToken);
  await sendEmail({
    to: contact.email,
    subject: "Confirma tu correo de SigfriedLootBox",
    idempotencyKey: `email-verify:${contact.id}:${tokenHash(rawToken)}`,
    html: `<h1>Confirma tu correo</h1><p>Usaremos este correo únicamente con tu permiso para darte la bienvenida y recordarte un carrito que dejaste guardado.</p><p><a href="${escapeHtml(verifyUrl.toString())}">Confirmar mi correo</a></p><p>Este enlace vence en 24 horas.</p>`,
  });
}

export function hashAutomationToken(value: string) { return tokenHash(value); }
