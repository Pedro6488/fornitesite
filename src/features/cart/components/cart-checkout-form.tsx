"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { BadgeCheck, Clock3, ShieldCheck } from "lucide-react";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { CommerceSheet } from "@/features/commerce/components/commerce-sheet";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import { SystemActionBar } from "@/shared/components/system-action-bar";

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
  const [quoteSheetOpen, setQuoteSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lines = useMemo(() => commerce.cartItemIds.flatMap((id) => { const item = items.find((candidate) => candidate.mainId === id); return item ? [item] : []; }), [commerce.cartItemIds, items]);
  const visibleTotal = lines.reduce((sum, item) => sum + (item.priceMxn ?? 0), 0);
  const waiting = commerce.validation?.status === "waiting";
  const manualReview = commerce.validation?.status === "manual_review";
  const isReady = commerce.validation?.status === "ready";
  const itemSignature = commerce.cartItemIds.join("|");
  const activeQuote = quote && quote.validationId === commerce.validation?.id && quote.itemSignature === itemSignature ? quote : null;

  const createQuote = useCallback(async () => {
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
  }, [commerce.validation, itemSignature, lines]);

  const closeQuoteSheet = useCallback(() => setQuoteSheetOpen(false), []);

  const openQuoteSheet = useCallback(() => {
    setQuoteSheetOpen(true);
    void createQuote();
  }, [createQuote]);

  const continueToContact = useCallback(() => {
    setQuoteSheetOpen(false);
    window.requestAnimationFrame(() => document.getElementById("checkout-contact")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

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
    <div className="flow-heading"><p className="eyebrow">CHECKOUT SEGURO</p><h1>Confirma tu solicitud.</h1><p>{waiting ? "La solicitud de amistad fue enviada. Podrás continuar al cumplirse las 48 horas." : manualReview ? "Tu ID espera la revisión del equipo antes de iniciar la espera de amistad." : "Confirmamos el ID y el precio antes de guardar tu pedido."}</p><ol className="checkout-steps"><li className={isReady ? "complete" : "active"}><span>1</span>{waiting ? "Espera de 48 horas" : "ID de entrega"}</li><li className={activeQuote ? "complete" : isReady ? "active" : ""}><span>2</span>Precio confirmado</li><li className={activeQuote ? "active" : ""}><span>3</span>Contacto y orden</li></ol></div>
    <form className="checkout-card" onSubmit={submit}>
      <div className="order-summary"><div><p className="eyebrow">TU PEDIDO</p><h2>{lines.length} {lines.length === 1 ? "objeto" : "objetos"}</h2><span>Una unidad de cada objeto</span></div><strong>{formatMxn((activeQuote?.amountMxnCents ?? visibleTotal * 100) / 100)}</strong></div>
      <div className="checkout-items">{(activeQuote?.lines ?? lines.map((item) => ({ itemMainId: item.mainId, name: item.name, amountMxnCents: (item.priceMxn ?? 0) * 100 }))).map((item) => <p key={item.itemMainId}><span>{item.name}</span><strong>{formatMxn(item.amountMxnCents / 100)}</strong></p>)}</div>
      <section className={`checkout-gate ${isReady ? "ready" : waiting ? "waiting" : manualReview ? "review" : ""}`}><div><small>PASO 1 · ID DE ENTREGA</small><strong>{commerce.validation?.display_name ?? "Aún no agregado"}</strong><p>{isReady ? "ID validado y listo para recibir objetos." : waiting ? `Solicitud enviada. Disponible ${commerce.validation?.giftable_at ? `a partir de ${new Date(commerce.validation.giftable_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}` : "cuando se cumplan las 48 horas"}.` : manualReview ? "Esperando que el equipo envíe la solicitud de amistad." : "Agrega el ID que recibirá los objetos."}</p></div><button type="button" onClick={commerce.openIdentity}>{isReady ? "Cambiar ID" : "Ver estado"}</button></section>
      {!activeQuote && <SystemActionBar className="checkout-quote-action" primaryFull><span><small>Total estimado</small><strong>{formatMxn(visibleTotal)}</strong><em>{lines.length} {lines.length === 1 ? "objeto" : "objetos"} · se confirma antes de ordenar</em></span><button type="button" className="primary-button" disabled={loading || !lines.length} onClick={isReady ? openQuoteSheet : commerce.openIdentity}>{loading ? "Confirmando…" : isReady ? "Confirmar precio y continuar" : waiting || manualReview ? "Ver estado de mi ID" : "Agregar ID para continuar"}</button></SystemActionBar>}
      {activeQuote && <>
        {activeQuote.amountMxnCents !== visibleTotal * 100 && <p className="notice">El precio fue actualizado por el servidor. Revisa el total antes de confirmar.</p>}
        <div id="checkout-contact" className="checkout-auth-choice"><div><strong>Compra como invitado</strong><p>Sólo necesitas WhatsApp y el ID que ya enviaste.</p></div><Link href="/cuenta?next=/checkout">Iniciar sesión</Link></div>
        <label>WhatsApp de contacto<input required inputMode="tel" pattern="[0-9+ ()-]{8,24}" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="55 5555 5555" /></label>
        <label>Correo electrónico <span>(opcional)</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>
        <div className="transfer-only"><span aria-hidden="true">▣</span><div><strong>Transferencia bancaria</strong><small>Después podrás subir tu comprobante o continuar por WhatsApp.</small></div></div>
        <SystemActionBar className="checkout-final-action" primaryFull><span><small>Total confirmado</small><strong>{formatMxn(activeQuote.amountMxnCents / 100)}</strong><em>Reservado hasta {new Date(activeQuote.expiresAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</em></span><button className="primary-button" disabled={loading}>{loading ? "Creando pedido…" : "Confirmar pedido"}</button><Link className="cart-secondary" href="/carrito">Volver al carrito</Link></SystemActionBar>
      </>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {!activeQuote && <Link className="cart-secondary" href="/carrito">Volver al carrito</Link>}
    </form>
    <CommerceSheet open={quoteSheetOpen} onClose={closeQuoteSheet} titleId="quote-sheet-title" eyebrow="PASO 2 · COMPRA PROTEGIDA" title="Precio y disponibilidad" description="Confirmamos los importes directamente en el servidor antes de crear tu orden." className="quote-confirmation-sheet">
      {loading && <div className="quote-sheet-loading" aria-live="polite"><Clock3 aria-hidden="true" size={22} /><div><strong>Confirmando tu selección</strong><span>Revisamos precio y disponibilidad de cada objeto.</span></div></div>}
      {!loading && activeQuote && <div className="quote-sheet-result" aria-live="polite">
        <div className="quote-sheet-status"><BadgeCheck aria-hidden="true" size={20} /><div><strong>Precio confirmado</strong><span>Disponible para continuar con contacto y orden.</span></div></div>
        <div className="quote-sheet-lines">{activeQuote.lines.map((line) => <p key={line.itemMainId}><span>{line.name}</span><strong>{formatMxn(line.amountMxnCents / 100)}</strong></p>)}</div>
        <div className="quote-sheet-total"><span>Total confirmado</span><strong>{formatMxn(activeQuote.amountMxnCents / 100)}</strong></div>
        <p className="quote-sheet-expiry"><ShieldCheck aria-hidden="true" size={15} />Reservado hasta {new Date(activeQuote.expiresAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</p>
        <SystemActionBar className="quote-sheet-actions" variant="contained"><button type="button" className="primary-button" onClick={continueToContact}>Continuar a contacto y orden</button></SystemActionBar>
      </div>}
      {!loading && error && <div className="quote-sheet-error"><p className="notice error" role="alert">{error}</p><button type="button" className="primary-button" onClick={() => void createQuote()}>Intentar nuevamente</button></div>}
    </CommerceSheet>
  </section>;
}
