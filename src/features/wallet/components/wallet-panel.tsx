"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { useStoreRegion } from "@/features/pricing/components/region-provider";
import { movementLabels, topupLabels, topupReference, topupStatus, walletMoney, type WalletTopup } from "../domain/wallet";
import { topupQuote, type PublicWalletOffers } from "../domain/wallet-offers";
import { toStore, whatsappLink } from "../domain/wallet-whatsapp";
import { useWallet, walletRequest } from "./use-wallet";
import { WalletAfterBuy, WalletBenefits, WalletCompare, WalletFaq, WalletPreviewCard, WalletRequirements, WalletSteps } from "./wallet-explainer";
import { WalletCalculator } from "./wallet-calculator";
import { WalletOfferBadge } from "./wallet-offer-badge";
import styles from "./wallet.module.css";
import explainer from "./wallet-explainer.module.css";

type Props = {
  /** Tarifas y ofertas públicas, para mostrar precios a quien no ha iniciado sesión. */
  offers?: PublicWalletOffers | null;
  /** "page" es /pavos completo; "account" es la pestaña de /cuenta, sin la explicación larga. */
  variant?: "page" | "account";
  /** Cantidad elegida en la portada (`/pavos?cantidad=5000`). */
  initialAmount?: number | null;
};

const n = (value: number) => value.toLocaleString("es-MX");

export function WalletPanel({ offers = null, variant = "page", initialAmount = null }: Props) {
  const commerce = useCommerceState();
  const { region } = useStoreRegion();
  const { data, error, reload } = useWallet(commerce.authenticated, commerce.sessionId);
  const [amount, setAmount] = useState(initialAmount ?? 3500);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const guest = commerce.ready && !commerce.authenticated;
  // Con sesión usamos las ofertas de la cuenta (respetan "solo primera recarga"); si no cargan, las públicas.
  const source = data ? { rates: data.rates, tiers: data.tiers ?? [], bonuses: data.bonuses ?? [] } : offers;
  const rate = source?.rates.find((item) => item.region === region);
  const regionTiers = (source?.tiers ?? []).filter((tier) => tier.region === region);
  const regionBonuses = (source?.bonuses ?? []).filter((bonus) => bonus.region === region);
  const quote = topupQuote(amount, rate, regionTiers, regionBonuses);
  const cents = quote?.cents ?? null;
  const pending = (data?.topups ?? []).filter((topup) => topupStatus(topup) === "awaiting_payment");
  const reviewing = (data?.topups ?? []).filter((topup) => topupStatus(topup) === "submitted");
  const balance = data?.balance ?? 0;
  // Paso actual del cliente: 0 elegir, 1 pagar y subir, 2 en revisión, 3 ya puede comprar.
  const step = pending.length > 0 ? 1 : reviewing.length > 0 ? 2 : balance > 0 ? 3 : 0;
  const pickAmount = (value: number) => { setAmount(value); setKey(null); };

  async function createTopup() {
    if (cents === null || busy) return;
    setBusy(true); setMessage("");
    const attemptKey = key ?? crypto.randomUUID(); setKey(attemptKey);
    try {
      await walletRequest("/api/wallet/topups", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ region, vbucks: amount, expectedCents: cents, expectedBonus: quote?.bonus ?? 0, key: attemptKey }) });
      setKey(null); setMessage("Recarga creada. Paga con los datos de arriba y sube tu comprobante.");
      await reload();
      document.getElementById("siguiente-paso")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No fue posible crear la recarga."); }
    finally { setBusy(false); }
  }
  async function receipt(event: FormEvent<HTMLFormElement>, topup: WalletTopup) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await walletRequest(`/api/wallet/topups/${topup.id}/receipt`, { method:"POST", body: new FormData(event.currentTarget) });
      setMessage("Comprobante recibido. Te avisamos por WhatsApp en cuanto acreditemos tus pavos."); await reload();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No fue posible enviar el comprobante."); }
    finally { setBusy(false); }
  }
  const support = (text: string) => whatsappLink(data?.supportWhatsapp, text);
  if (!commerce.ready) return <p>Cargando tu cuenta…</p>;

  const hero = <header className={explainer.hero}>
    <div>
      <p className={explainer.eyebrow}>PAVOS DE LA TIENDA</p>
      <h1>RECARGA UNA VEZ.<br /><span>COMPRA AL INSTANTE.</span></h1>
      <p className={explainer.lead}>Tu saldo en SigfriedLootBox. Confirmamos tu pago una sola vez, al recargar. Después, cada objeto que pagues con pavos se envía solo a tu ID de Fortnite, sin subir otro comprobante.</p>
      <WalletOfferBadge offers={source} />
      <div className={explainer.actions}>
        {guest ? <>
          <Link className={explainer.primary} href="/cuenta?mode=register&next=/pavos">Crear cuenta y recargar <ArrowUpRight size={18} aria-hidden="true" /></Link>
          <Link className={explainer.secondary} href="/cuenta?next=/pavos">Ya tengo cuenta</Link>
        </> : <>
          <a className={explainer.primary} href="#recargar">Recargar ahora <ArrowRight size={18} aria-hidden="true" /></a>
          {balance > 0 && <Link className={explainer.secondary} href="/fortnite#catalogo">Usar mis pavos</Link>}
        </>}
      </div>
      <small className={explainer.disclaimer}>No son paVos de tu cuenta de Epic: se usan solo aquí. Nunca te pedimos tu contraseña.</small>
    </div>
    {guest ? <WalletPreviewCard label="Así se ve tu saldo" /> : <div className={explainer.balanceCard} aria-live="polite">
      <small>Tu saldo</small>
      <strong>{data ? n(data.balance) : error ? "—" : "…"}</strong>
      <span>pavos disponibles</span>
      {reviewing.length > 0 && <span>+{n(reviewing.reduce((sum, t) => sum + t.vbucks + (t.bonus_vbucks ?? 0), 0))} en revisión</span>}
    </div>}
  </header>;

  const why = <section className={explainer.block} id="como-funciona" aria-labelledby="why-title">
    <header><p className={explainer.eyebrow}>CÓMO FUNCIONA</p><h2 id="why-title">¿POR QUÉ TENER <span>SALDO?</span></h2><p>Con el pago habitual revisamos tu pago en cada pedido. Con pavos lo revisamos una sola vez, al recargar, y tus compras salen en cuanto las confirmas.</p></header>
    <WalletBenefits />
    <WalletCompare />
    <WalletRequirements />
    {guest && <><h3>Tu primera recarga, paso a paso</h3><WalletSteps /></>}
  </section>;

  const faq = <section className={explainer.block} aria-labelledby="faq-title"><header><p className={explainer.eyebrow}>PREGUNTAS FRECUENTES</p><h2 id="faq-title">SIN DUDAS, <span>A RECARGAR.</span></h2></header><WalletFaq /></section>;

  const recharge = <section className={styles.recharge} id="recargar" aria-labelledby="recharge-title"><div><p className="eyebrow">RECARGA TU SALDO</p><h2 id="recharge-title">Juega con la cantidad</h2><p>Mueve la barra o elige un escalón: ves al momento cuánto pagas, cuántos pavos recibes y tu regalo.</p></div>
    {regionBonuses.length > 0 && <div className={styles.campaign} role="note">{regionBonuses.map((bonus) => <p key={bonus.id}>🎁 <strong>{bonus.label}</strong>: +{(bonus.bonus_bp/100).toLocaleString("es-MX")}% de pavos de regalo desde {n(bonus.min_vbucks)}{bonus.bonus_cap ? ` (hasta ${n(bonus.bonus_cap)})` : ""}{bonus.first_topup_only ? " en tu primera recarga" : ""}. Válido hasta el {new Date(bonus.ends_at).toLocaleDateString("es-MX", { day:"numeric", month:"long" })}.</p>)}</div>}
    <WalletCalculator amount={amount} onAmount={pickAmount} source={source} disabled={busy} aside={<details className={styles.afterDetails} open><summary>¿Qué pasa después de comprar?</summary><WalletAfterBuy /></details>}>
      {() => <>
        {!guest && data && <p className={styles.after}>Saldo después de acreditarse: <strong>{n(balance + (quote?.credited ?? amount))} pavos</strong></p>}
        {guest
          ? <Link className="primary-button" href={`/cuenta?next=${encodeURIComponent(`/pavos?cantidad=${amount}#recargar`)}`}>Inicia sesión para comprar</Link>
          : <button type="button" className="primary-button" disabled={cents===null || !data || busy} onClick={() => void createTopup()}>{busy ? "Procesando…" : `Comprar ${n(amount)} pavos`}</button>}
      </>}
    </WalletCalculator>
  </section>;

  return <div className={`${styles.panel} ${explainer.explainer}`}>
    {variant === "page" && hero}
    {variant === "account" && <div className={explainer.balanceCard}><small>Tu saldo</small><strong>{data ? n(data.balance) : error ? "—" : "…"}</strong><span>pavos disponibles · <Link href="/pavos#como-funciona">¿Cómo funcionan los pavos?</Link></span></div>}

    {error && <div className="notice error" role="alert"><p>No pudimos cargar tu saldo en este momento. Tus pavos están seguros; intenta de nuevo en unos minutos.</p><button type="button" className="secondary-button" onClick={() => void reload()}><RefreshCw size={15} aria-hidden="true" /> Reintentar</button></div>}
    {data?.paused && !data.frozen && <p className="notice" role="status">El pago con pavos está pausado unos minutos mientras revisamos las entregas. Tu saldo está seguro y puedes seguir recargando.</p>}
    {data?.frozen && <p className="notice error" role="alert">Tu saldo está en revisión y por ahora no puedes pagar con pavos. Escríbenos para resolverlo; mientras tanto puedes usar el pago habitual.</p>}
    {data?.frozen && support(toStore.frozen()) && <a className="secondary-button" href={support(toStore.frozen())!} target="_blank" rel="noreferrer">Escribir por WhatsApp</a>}

    {data && <section className={explainer.block} id="siguiente-paso" aria-labelledby="progress-title">
      <header><p className={explainer.eyebrow}>TU AVANCE</p><h2 id="progress-title">{step === 0 ? <>ELIGE TU <span>RECARGA</span></> : step === 1 ? <>PAGA Y SUBE TU <span>COMPROBANTE</span></> : step === 2 ? <>ESTAMOS REVISANDO <span>TU PAGO</span></> : <>LISTO PARA <span>COMPRAR</span></>}</h2>
        <p>{step === 0 ? "Elige cuántos pavos quieres abajo. Te damos los datos de pago y tu referencia." : step === 1 ? "Haz el pago con la referencia de tu recarga y sube el comprobante aquí mismo." : step === 2 ? "Confirmamos tu pago con la referencia y te avisamos por WhatsApp cuando tus pavos estén en tu saldo." : "En el checkout elige “Mis pavos de la tienda” y tu pedido se envía solo."}</p></header>
      <WalletSteps current={step} />
      {step === 3 && <Link className={explainer.primary} href="/fortnite#catalogo">Ver objetos <ArrowUpRight size={18} aria-hidden="true" /></Link>}
      {pending.map((t) => <article key={t.id} className={styles.pendingCard}>
        <header><strong>{n(t.vbucks)} pavos{t.bonus_vbucks ? ` + ${n(t.bonus_vbucks)} de regalo` : ""}</strong><span>{walletMoney(t.amount_cents,t.region)}</span></header>
        <div className={styles.payment}>{t.region==="mx" ? <><p>Banco: <strong>{data.paymentDetails.name}</strong></p><p>Beneficiario: <strong>{data.paymentDetails.beneficiary}</strong></p><p>CLABE: <strong>{data.paymentDetails.clabe}</strong></p></> : <p>PayPal: <strong>{data.paymentDetails.paypal}</strong></p>}<p>Monto exacto: <strong>{walletMoney(t.amount_cents,t.region)}</strong></p><p>Escribe en el concepto o la nota del pago: <strong className={styles.reference}>{topupReference(t)}</strong></p></div>
        {t.expires_at && <small>Paga y sube tu comprobante antes del {new Date(t.expires_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}.</small>}
        <form onSubmit={(e) => void receipt(e,t)}><label>Comprobante de la recarga<input type="file" name="receipt" accept="image/jpeg,image/png,application/pdf" required disabled={busy} /></label><small>JPG, PNG o PDF de máximo 5 MB.</small><button className="primary-button" disabled={busy}>Enviar comprobante</button></form>
      </article>)}
    </section>}

    {message && <p className="notice" role="status">{message}</p>}
    {recharge}
    {guest && variant === "page" && why}

    {data && <section><h2>Mis recargas</h2><p>Se muestran las últimas 100 recargas.</p><div className={styles.list}>{data.topups.length===0 && <p>Aún no has comprado pavos.</p>}{data.topups.map((t) => { const status = topupStatus(t); return <article key={t.id}><header><strong>{n(t.vbucks)} pavos{t.bonus_vbucks ? ` + ${n(t.bonus_vbucks)} de regalo` : ""}</strong><span>{walletMoney(t.amount_cents,t.region)}</span><b>{topupLabels[status]}</b></header><small>{topupReference(t)} · {new Date(t.created_at).toLocaleDateString("es-MX")}{status==="awaiting_payment" && " · Paga y sube tu comprobante en «Tu avance»"}</small>{t.review_note && <p>{t.review_note}</p>}
      {status==="expired" && <p>Esta recarga venció sin comprobante. Crea una nueva; si ya pagaste, escríbenos con tu comprobante.</p>}
      {(status==="expired" || status==="rejected") && (() => { const href = support(status==="expired" ? toStore.topupExpired({ reference: topupReference(t), vbucks: t.vbucks }) : toStore.topupRejected({ reference: topupReference(t), vbucks: t.vbucks })); return href && <a className="secondary-button" href={href} target="_blank" rel="noreferrer">{status==="expired" ? "Ya pagué: enviar comprobante por WhatsApp" : "Revisar mi recarga por WhatsApp"}</a>; })()}
    </article>; })}</div></section>}
    {data && <section><h2>Movimientos de pavos</h2><p>Últimos 100 movimientos.</p><div className={styles.list}>{data.movements.length===0 && <p>Todavía no hay movimientos.</p>}{data.movements.map((m) => <article key={m.id}><header><span>{movementLabels[m.kind]}</span><strong>{m.delta>0 ? "+" : ""}{n(m.delta)}</strong></header><small>{new Date(m.created_at).toLocaleString("es-MX")}</small></article>)}</div><Link href="/cuenta">Ver mis pedidos y entregas</Link></section>}

    {!guest && variant === "page" && why}
    {variant === "page" && faq}
    {guest && variant === "page" && <aside className={explainer.closing}><div><h2>¿Listo para tu primera recarga?</h2><p>Crea tu cuenta en un minuto y elige cuántos pavos quieres.</p></div><Link className={explainer.primary} href="/cuenta?mode=register&next=/pavos">Crear cuenta y recargar <ArrowUpRight size={18} aria-hidden="true" /></Link></aside>}
  </div>;
}
