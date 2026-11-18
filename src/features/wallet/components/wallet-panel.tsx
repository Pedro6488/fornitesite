"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { useStoreRegion } from "@/features/pricing/components/region-provider";
import { topupLabels, topupPrice, walletMoney, type WalletTopup } from "../domain/wallet";
import { useWallet, walletRequest } from "./use-wallet";
import styles from "./wallet.module.css";

export function WalletPanel() {
  const commerce = useCommerceState();
  const { region } = useStoreRegion();
  const { data, error, reload } = useWallet(commerce.authenticated, commerce.sessionId);
  const [amount, setAmount] = useState(3500);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const cents = topupPrice(amount, data?.rates.find((rate) => rate.region === region));
  async function createTopup() {
    if (cents === null || busy) return;
    setBusy(true); setMessage("");
    const attemptKey = key ?? crypto.randomUUID(); setKey(attemptKey);
    try {
      await walletRequest("/api/wallet/topups", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ region, vbucks: amount, expectedCents: cents, key: attemptKey }) });
      setKey(null); setMessage("Recarga creada. Revisa los datos de pago y adjunta tu comprobante abajo."); await reload();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No fue posible crear la recarga."); }
    finally { setBusy(false); }
  }
  async function receipt(event: FormEvent<HTMLFormElement>, topup: WalletTopup) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await walletRequest(`/api/wallet/topups/${topup.id}/receipt`, { method:"POST", body: new FormData(event.currentTarget) });
      setMessage("Comprobante recibido. Los pavos se acreditarán cuando se confirme el pago."); await reload();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No fue posible enviar el comprobante."); }
    finally { setBusy(false); }
  }
  if (!commerce.ready) return <p>Cargando tu cuenta…</p>;
  if (!commerce.authenticated) return <div className={styles.panel}><h2>Tus pavos de la tienda</h2><p>Inicia sesión para comprar y usar tu saldo.</p><Link className="primary-button" href="/cuenta?next=/pavos">Iniciar sesión</Link></div>;
  return <div className={styles.panel}>
    <header className={styles.balance}><div><p className="eyebrow">PAVOS DE LA TIENDA</p><h2>Tu próxima compra empieza aquí</h2><p>Saldo para comprar objetos en SigfriedLootBox. Se usa dentro de esta página.</p></div><div><strong>{data ? data.balance.toLocaleString("es-MX") : "…"}</strong><span>pavos disponibles</span></div></header>
    {error && <p className="notice error" role="alert">{error}</p>}
    <section className={styles.recharge} aria-labelledby="recharge-title"><div><p className="eyebrow">RECARGA TU SALDO</p><h3 id="recharge-title">¿Cuántos pavos quieres comprar?</h3><p>Elige de 100 a 50,000 pavos, en incrementos de 100.</p></div>
      <fieldset disabled={busy}><label htmlFor="wallet-range">Cantidad de pavos <strong>{amount.toLocaleString("es-MX")}</strong></label><input id="wallet-range" type="range" min={100} max={50000} step={100} value={amount} onChange={(e) => { setAmount(Number(e.target.value)); setKey(null); }} />
      <div className={styles.amountButtons}>{[1000,3500,5000,13500].map((n) => <button type="button" key={n} aria-pressed={amount===n} onClick={() => { setAmount(n); setKey(null); }}>{n.toLocaleString("es-MX")}</button>)}</div>
      <div className={styles.summary}><span>Total ({region === "mx" ? "México · transferencia" : "USA · PayPal"})</span><strong>{cents === null ? "Precio por definir" : walletMoney(cents,region)}</strong><span>Saldo después de acreditarse</span><strong>{((data?.balance ?? 0)+amount).toLocaleString("es-MX")} pavos</strong></div>
      {cents === null && <p>Las recargas estarán disponibles cuando se publique la tarifa de tu región.</p>}
      <button type="button" className="primary-button" disabled={cents===null || !data} onClick={() => void createTopup()}>{busy ? "Procesando…" : "Comprar pavos"}</button></fieldset>
      <small>Tu saldo aumenta después de verificar el pago de la recarga. Al comprar objetos con saldo suficiente, el envío se inicia automáticamente.</small>
    </section>
    {message && <p className="notice" role="status">{message}</p>}
    <section><h3>Mis recargas</h3><p>Se muestran las últimas 100 recargas.</p><div className={styles.list}>{data?.topups.length===0 && <p>Aún no has comprado pavos.</p>}{data?.topups.map((t) => <article key={t.id}><header><strong>{t.vbucks.toLocaleString("es-MX")} pavos</strong><span>{walletMoney(t.amount_cents,t.region)}</span><b>{topupLabels[t.status]}</b></header><small>Recarga #{t.id.slice(0,8).toUpperCase()} · {new Date(t.created_at).toLocaleDateString("es-MX")}</small>{t.review_note && <p>{t.review_note}</p>}
      {t.status==="awaiting_payment" && <><div className={styles.payment}>{t.region==="mx" ? <><p>Banco: <strong>{data.paymentDetails.name}</strong></p><p>Beneficiario: <strong>{data.paymentDetails.beneficiary}</strong></p><p>CLABE: <strong>{data.paymentDetails.clabe}</strong></p></> : <p>PayPal: <strong>{data.paymentDetails.paypal}</strong></p>}<p>Referencia: RECARGA-{t.id.slice(0,8).toUpperCase()}</p></div><form onSubmit={(e) => void receipt(e,t)}><label>Comprobante de la recarga<input type="file" name="receipt" accept="image/jpeg,image/png,application/pdf" required disabled={busy} /></label><small>JPG, PNG o PDF de máximo 5 MB.</small><button className="secondary-button" disabled={busy}>Enviar comprobante</button></form></>}
    </article>)}</div></section>
    <section><h3>Movimientos de pavos</h3><p>Últimos 100 movimientos.</p><div className={styles.list}>{data?.movements.map((m) => <article key={m.id}><header><span>{m.kind==="topup" ? "Recarga acreditada" : m.kind==="purchase" ? "Compra de objetos" : "Pavos devueltos"}</span><strong>{m.delta>0 ? "+" : ""}{m.delta.toLocaleString("es-MX")}</strong></header><small>{new Date(m.created_at).toLocaleString("es-MX")}</small></article>)}</div><Link href="/cuenta">Ver mis pedidos y entregas</Link></section>
  </div>;
}
