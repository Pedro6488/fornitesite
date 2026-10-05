"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

type Quote = Readonly<{
  id: string;
  expiresAt: string;
  amountMxnCents: number;
  totalVbucks: number;
  lines: readonly { itemMainId: string; name: string; imageUrl: string | null; vbucksPrice: number; amountMxnCents: number }[];
  validationId: string;
  itemSignature: string;
  idempotencyKey: string;
}>;

async function authHeaders(): Promise<HeadersInit> {
  const token = (await getSupabaseBrowser()?.auth.getSession())?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function CartCheckoutForm({ items }: { items: readonly CatalogItem[] }) {
  const router = useRouter();
  const commerce = useCommerceState();
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lines = useMemo(() => commerce.cartItemIds.flatMap((id) => { const item = items.find((candidate) => candidate.mainId === id); return item ? [item] : []; }), [commerce.cartItemIds, items]);
  const visibleTotal = lines.reduce((sum, item) => sum + (item.priceMxn ?? 0), 0);
  const isReady = commerce.validation?.status === "ready";
  const itemSignature = commerce.cartItemIds.join("|");
  const activeQuote = quote && quote.validationId === commerce.validation?.id && quote.itemSignature === itemSignature ? quote : null;

  async function createQuote() {
    if (!commerce.validation || !lines.length) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ validationId: commerce.validation.id, itemIds: lines.map((item) => item.mainId) })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setQuote({ ...body.quote, validationId: commerce.validation.id, itemSignature, idempotencyKey: crypto.randomUUID() });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No fue posible revisar la compra."); }
    finally { setLoading(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!activeQuote || !commerce.validation) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/cart-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ quoteId: activeQuote.id, validationId: commerce.validation.id, whatsapp, customerEmail: email, idempotencyKey: activeQuote.idempotencyKey })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      commerce.clearCart();
      router.push(`/pedidos/${body.order.id}?access=${body.order.publicToken}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No fue posible confirmar el pedido."); }
    finally { setLoading(false); }
  }

  if (commerce.ready && !lines.length) return <section className="flow-shell"><div className="flow-heading"><p className="eyebrow">SOLICITUD</p><h1>Tu carrito está vacío.</h1><Link className="primary-button" href="/#catalogo">Explorar tienda</Link></div></section>;

  return <section className="flow-shell checkout-flow">
    <div className="flow-heading"><p className="eyebrow">CHECKOUT SEGURO</p><h1>Confirma tu solicitud.</h1><p>Validamos identidad, amistad, capacidad y precio antes de guardar tu pedido.</p><ol className="checkout-steps"><li className={isReady ? "complete" : "active"}><span>1</span>ID entregable</li><li className={activeQuote ? "complete" : isReady ? "active" : ""}><span>2</span>Precio confirmado</li><li className={activeQuote ? "active" : ""}><span>3</span>Contacto y orden</li></ol></div>
    <form className="checkout-card" onSubmit={submit}>
      <div className="order-summary"><div><p className="eyebrow">TU PEDIDO</p><h2>{lines.length} {lines.length === 1 ? "objeto" : "objetos"}</h2><span>Una unidad de cada objeto</span></div><strong>{formatMxn((activeQuote?.amountMxnCents ?? visibleTotal * 100) / 100)}</strong></div>
      <div className="checkout-items">{(activeQuote?.lines ?? lines.map((item) => ({ itemMainId: item.mainId, name: item.name, amountMxnCents: (item.priceMxn ?? 0) * 100 }))).map((item) => <p key={item.itemMainId}><span>{item.name}</span><strong>{formatMxn(item.amountMxnCents / 100)}</strong></p>)}</div>
      <section className={`checkout-gate ${isReady ? "ready" : ""}`}><div><small>PASO 1 · ID DE ENTREGA</small><strong>{commerce.validation?.display_name ?? "Aún no validado"}</strong><p>{isReady ? "Amistad y espera confirmadas." : "Necesitas un ID listo antes de cotizar."}</p></div><button type="button" onClick={commerce.openIdentity}>{isReady ? "Cambiar ID" : "Validar ID"}</button></section>
      {!activeQuote && <button type="button" className="primary-button" disabled={!isReady || loading || !lines.length} onClick={() => void createQuote()}>{loading ? "Revisando disponibilidad…" : "Confirmar precio y disponibilidad"}</button>}
      {activeQuote && <>
        {activeQuote.amountMxnCents !== visibleTotal * 100 && <p className="notice">El precio fue actualizado por el servidor. Revisa el total antes de confirmar.</p>}
        <div className="checkout-auth-choice"><div><strong>Compra como invitado</strong><p>Sólo necesitas WhatsApp y tu ID validado.</p></div><Link href="/cuenta?next=/checkout">Iniciar sesión</Link></div>
        <label>WhatsApp de contacto<input required inputMode="tel" pattern="[0-9+ ()-]{8,24}" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="55 5555 5555" /></label>
        <label>Correo electrónico <span>(opcional)</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>
        <div className="transfer-only"><span aria-hidden="true">▣</span><div><strong>Transferencia bancaria</strong><small>Después podrás subir tu comprobante o continuar por WhatsApp.</small></div></div>
        <p className="quote-expiry">Precio reservado hasta {new Date(activeQuote.expiresAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</p>
        <button className="primary-button" disabled={loading}>{loading ? "Creando pedido…" : "Confirmar pedido"}</button>
      </>}
      {error && <p className="notice error" role="alert">{error}</p>}
      <Link className="cart-secondary" href="/carrito">Volver al carrito</Link>
    </form>
  </section>;
}
