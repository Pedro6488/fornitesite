"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AdminPageHeader } from "@/features/admin/components/admin-shell";
import { useAdminData, useAdminRequest } from "@/features/admin/components/use-admin-request";
import { PAYPAL_FIXED_CENTS, PAYPAL_PERCENT_BP, movementLabels, paypalNetCents, topupLabels, topupReference, topupStatus, walletMoney, type WalletMovement, type WalletRate, type WalletTopup } from "../domain/wallet";
import { toCustomer, trackingUrl, whatsappLink, type WhatsappRegion } from "../domain/wallet-whatsapp";
import styles from "./wallet.module.css";
type Account = { user_id: string; email: string; balance: number; purchased: number; spent: number; refunded: number; adjusted?: number; frozen?: boolean; frozen_reason?: string | null; whatsapp?: string | null };
type WalletOrder = { id: string; status: string; public_token: string | null; epic_display_name: string; wallet_vbucks: number; created_at: string; contact_whatsapp: string | null; currency: string | null; order_items: { item_name: string; vbucks_price: number; quantity?: number; wallet_refunded: boolean }[]; fulfillments: { status: string; last_error: string | null }[] };
type Notice = { label: string; href: string | null };
const appUrl = () => typeof window === "undefined" ? "" : window.location.origin;

/** Abre WhatsApp con el aviso escrito. Sin teléfono registrado, lo dice en lugar de un botón muerto. */
function WhatsappButton({ href, children }: { href: string | null; children: string }) {
  return href ? <a className="secondary-button" href={href} target="_blank" rel="noreferrer">{children} ↗</a> : <small>El cliente no tiene WhatsApp registrado.</small>;
}

function orderNotice(order: WalletOrder, phone: string | null | undefined): Notice | null {
  const region: WhatsappRegion = order.currency === "USD" ? "us" : "mx";
  const url = trackingUrl(appUrl(), order);
  const names = (refunded: boolean) => order.order_items.filter((item) => item.wallet_refunded === refunded).map((item) => item.item_name);
  const refundedItems = order.order_items.filter((item) => item.wallet_refunded);
  if (refundedItems.length) {
    const vbucks = refundedItems.reduce((sum, item) => sum + item.vbucks_price * (item.quantity ?? 1), 0);
    return { label: "Avisar devolución por WhatsApp", href: whatsappLink(order.contact_whatsapp ?? phone, toCustomer.refunded({ orderId: order.id, items: names(true), vbucks, url }), region) };
  }
  if (order.status === "delivered") return { label: "Avisar entrega por WhatsApp", href: whatsappLink(order.contact_whatsapp ?? phone, toCustomer.delivered({ orderId: order.id, items: names(false), displayName: order.epic_display_name, url }), region) };
  return null;
}

function topupNotice(topup: WalletTopup, account: Account | undefined, balance: number): Notice | null {
  const reference = topupReference(topup);
  if (topup.status === "approved") return { label: "Avisar acreditación por WhatsApp", href: whatsappLink(account?.whatsapp, toCustomer.topupApproved({ reference, vbucks: topup.vbucks, balance, appUrl: appUrl() }), topup.region) };
  if (topup.status === "rejected") return { label: "Avisar rechazo por WhatsApp", href: whatsappLink(account?.whatsapp, toCustomer.topupRejected({ reference, vbucks: topup.vbucks, reason: topup.review_note ?? "sin detalle" }), topup.region) };
  return null;
}
type Summary = { liability: number; accounts: number; frozen_accounts: number; spent_today: number; refunded_today: number; credited_today: number; pending_topups: number; attention_jobs: number; paused_until: string | null; pause_reason: string | null };
type AttentionJob = { id: string; aggregate_id: string; status: string; attempts: number; last_error: string | null; updated_at: string };
const orderLabels: Record<string,string> = { paid:"Pagado", ready_to_send:"En cola", validating_delivery:"Validando entrega", delivering:"Enviando", reconciling:"Confirmando envío", manual_review:"Requiere atención", delivered:"Entregado / resuelto", refunded:"Pavos devueltos", canceled:"Cancelado" };
export function AdminWallet() {
  const request = useAdminRequest();
  const { data,error,reload } = useAdminData<{ accounts: Account[]; pending: WalletTopup[]; rates: WalletRate[]; summary: Summary | null; attention: AttentionJob[] }>("/api/admin/wallet", { refreshMs: 30000 });
  const [selected,setSelected] = useState<string | null>(null);
  const details = useAdminData<{ movements: WalletMovement[]; orders: WalletOrder[]; topups: WalletTopup[] }>(selected ? `/api/admin/wallet?userId=${selected}` : null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [notes,setNotes] = useState<Record<string,string>>({});
  const [search,setSearch] = useState("");
  const [notice,setNotice] = useState<Notice | null>(null);
  async function review(topup: WalletTopup, approve: boolean) {
    const account = data?.accounts.find((a) => a.user_id===topup.user_id);
    const note = (notes[topup.id] ?? "").trim();
    if (!await action({ action:"review", id:topup.id, approve, note })) return;
    // Tras revisar, la recarga sale de la lista: el aviso queda a la mano para mandarlo al cliente.
    setNotice(topupNotice({ ...topup, status: approve ? "approved" : "rejected", review_note: note || null }, account, (account?.balance ?? 0) + (approve ? topup.vbucks : 0)));
  }
  async function action(body: unknown): Promise<boolean> {
    setBusy(true); setMessage("");
    try { await request("/api/admin/wallet", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body) }); setMessage("Cambios guardados."); await reload(); if(selected) await details.reload(); return true; }
    catch(cause) { setMessage(cause instanceof Error ? cause.message : "No fue posible guardar."); return false; }
    finally { setBusy(false); }
  }
  function rate(event: FormEvent<HTMLFormElement>, region: string) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void action({ action:"rate", region, centsPer100:Math.round(Number(form.get("price"))*100), active:form.get("active")==="on" });
  }
  return <><AdminPageHeader title="Clientes con pavos" lead="Saldos de la tienda, recargas y entregas pagadas con pavos." actions={<button className="ac-ghost" onClick={() => void reload()}>Actualizar</button>} />
    {(error || message) && <p className="ac-notice" role="status">{error ?? message}</p>}
    {notice && <div className={styles.whatsNotice} role="status"><p>Avisa al cliente: el mensaje ya va escrito, solo revisa y envía.</p><WhatsappButton href={notice.href}>{notice.label}</WhatsappButton><button className="ac-ghost" onClick={() => setNotice(null)}>Cerrar</button></div>}
    <div className={styles.panel}>
    {data?.summary?.paused_until && <section className={styles.paused} role="alert"><div><h2>Pago con pavos pausado</h2><p>{data.summary.pause_reason ?? "Falla de la cuenta emisora"}. Se reanuda solo a las {new Date(data.summary.paused_until).toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit" })}. Mientras tanto, los clientes solo pueden usar el pago habitual y los objetos no enviados se devuelven al saldo. Revisa las cuentas en FN Shop antes de reanudar.</p></div><button className="secondary-button" disabled={busy} onClick={() => void action({ action:"resume" })}>Reanudar ahora</button></section>}
    {data?.summary && <section aria-label="Resumen de pavos" className={styles.stats}>
      <div><span>Pavos por entregar (pasivo)</span><strong>{Number(data.summary.liability).toLocaleString("es-MX")}</strong><small>Saldo total de {Number(data.summary.accounts).toLocaleString("es-MX")} clientes. Ya se cobró y aún se debe entregar.</small></div>
      <div><span>Gastados hoy</span><strong>{Number(data.summary.spent_today).toLocaleString("es-MX")}</strong><small>Acreditados hoy: {Number(data.summary.credited_today).toLocaleString("es-MX")}</small></div>
      <div><span>Devueltos hoy</span><strong>{Number(data.summary.refunded_today).toLocaleString("es-MX")}</strong><small>Objetos que no se pudieron enviar</small></div>
      <div><span>Recargas por revisar</span><strong>{Number(data.summary.pending_topups).toLocaleString("es-MX")}</strong><small>Cuentas congeladas: {Number(data.summary.frozen_accounts).toLocaleString("es-MX")}</small></div>
      <div data-alert={Number(data.summary.attention_jobs) > 0}><span>Entregas que requieren atención</span><strong>{Number(data.summary.attention_jobs).toLocaleString("es-MX")}</strong><small>Fallidas o con más de 3 intentos</small></div>
    </section>}
    {!!data?.attention.length && <section><h2>Entregas con pavos que requieren atención</h2><p>Ya no se reintentan solas (fallidas) o llevan varios intentos. Abre el pedido, concilia y resuelve a mano.</p><div className={styles.list}>{data.attention.map((job) => <article key={job.id}><header><Link href={`/admin/pedidos/${job.aggregate_id}`}>Pedido #{job.aggregate_id.slice(0,8).toUpperCase()}</Link><strong>{job.status === "failed" ? "Fallida" : `En cola · ${job.attempts} intentos`}</strong></header><p>{job.last_error ?? "Sin detalle"}</p><small>Último intento: {new Date(job.updated_at).toLocaleString("es-MX")}</small></article>)}</div></section>}
    <section className={styles.recharge}><h2>Tarifas de recarga</h2><p>Precio por cada 100 pavos. Las recargas permanecen bloqueadas hasta activar una tarifa. Las solicitudes ya creadas conservan su precio.</p>
      {data?.rates.map((r) => <form key={`${r.region}-${r.cents_per_100}-${r.active}`} onSubmit={(e) => rate(e,r.region)}><fieldset disabled={busy}><h3>{r.region==="mx" ? "México · MXN" : "USA · USD"}</h3><label>Precio por 100 pavos<input name="price" type="number" min="0.01" max="10000" step="0.01" required defaultValue={r.cents_per_100 ? r.cents_per_100/100 : ""} /></label>{r.region==="us" && r.cents_per_100 && <p className={styles.netNote}>PayPal cobra {PAYPAL_PERCENT_BP/100}% + ${(PAYPAL_FIXED_CENTS/100).toFixed(2)} por pago. Con esta tarifa, una recarga de 1,000 pavos ({walletMoney(r.cents_per_100*10,"us")}) te deja ≈ {walletMoney(Math.round(paypalNetCents(r.cents_per_100*10)/10),"us")} netos por cada 100 pavos; una de 5,000 deja ≈ {walletMoney(Math.round(paypalNetCents(r.cents_per_100*50)/50),"us")} por 100. El pedido habitual en USA cobra aparte $2.30 de comisión; la recarga no.</p>}<label><span><input type="checkbox" name="active" defaultChecked={r.active} /> Habilitar recargas en esta región</span></label><button className="secondary-button">Guardar tarifa</button></fieldset></form>)}
    </section>
    <section><h2>Comprobantes de recargas por revisar ({data?.pending.length ?? 0})</h2><div className={styles.list}>{data?.pending.length===0 && <p>No hay recargas pendientes de revisión.</p>}{data?.pending.map((t) => <article key={t.id}><header><strong>{t.vbucks.toLocaleString("es-MX")} pavos · {walletMoney(t.amount_cents,t.region)}</strong><button className="ac-ghost" onClick={() => setSelected(t.user_id)}>Ver cliente</button></header><p>Recarga #{t.id.slice(0,8)} · {data.accounts.find((a) => a.user_id===t.user_id)?.email ?? t.user_id}</p><p>Busca en el banco o en PayPal el concepto <strong>{topupReference(t)}</strong> por {walletMoney(t.amount_cents,t.region)}. No apruebes solo por la imagen.</p>{data.accounts.find((a) => a.user_id===t.user_id)?.frozen && <p role="alert">⚠️ La cuenta de este cliente está congelada.</p>}{t.receiptUrl ? <a href={t.receiptUrl} target="_blank" rel="noreferrer">Abrir comprobante de pago ↗</a> : <p>No se pudo abrir el comprobante. Actualiza antes de aprobar.</p>}<label>Nota de revisión (obligatoria al rechazar)<input maxLength={1000} value={notes[t.id] ?? ""} onChange={(e) => setNotes({ ...notes,[t.id]:e.target.value })} /></label><div className={styles.amountButtons}><button disabled={busy || !t.receiptUrl} onClick={() => void review(t,true)}>Confirmar pago y acreditar pavos</button><button disabled={busy || (notes[t.id]?.trim().length ?? 0)<5} onClick={() => void review(t,false)}>Rechazar recarga</button></div></article>)}</div></section>
    <section><h2>Saldos de clientes</h2><label>Buscar entre los últimos 500 clientes<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Correo o ID del cliente" /></label><div className={styles.list}>{data?.accounts.filter((a) => `${a.email} ${a.user_id}`.toLowerCase().includes(search.toLowerCase())).map((a) => <article key={a.user_id}><header><strong>{a.email || a.user_id}</strong><strong>{a.frozen ? "🔒 Congelada · " : ""}{a.balance.toLocaleString("es-MX")} disponibles</strong></header><p>Comprados: {Number(a.purchased).toLocaleString("es-MX")} · Utilizados: {Number(a.spent).toLocaleString("es-MX")} · Devueltos: {Number(a.refunded).toLocaleString("es-MX")}{Number(a.adjusted ?? 0) !== 0 && ` · Ajustes: ${Number(a.adjusted) > 0 ? "+" : ""}${Number(a.adjusted).toLocaleString("es-MX")}`}</p>{a.frozen && <p>Motivo del congelamiento: {a.frozen_reason}</p>}<button className="ac-ghost" onClick={() => setSelected(a.user_id)}>Ver recargas, movimientos y envíos</button></article>)}</div></section>
    {selected && <section aria-label="Detalle del cliente"><h2>Historial: {data?.accounts.find((a) => a.user_id===selected)?.email ?? selected}</h2>{details.error && <p role="alert">{details.error}</p>}<p>Últimos 200 registros de cada tipo.</p>{(() => { const account = data?.accounts.find((a) => a.user_id===selected); return <AccountControls key={selected} userId={selected} account={account} busy={busy} onAction={action} />; })()}<h3>Envíos con pavos</h3><div className={styles.list}>{details.data?.orders.map((o) => <article key={o.id}><header><Link href={`/admin/pedidos/${o.id}`}>Pedido #{o.id.slice(0,8)} · {o.epic_display_name}</Link><strong>{orderLabels[o.status] ?? o.status}</strong></header><p>{new Date(o.created_at).toLocaleString("es-MX")} · {o.wallet_vbucks.toLocaleString("es-MX")} pavos</p><ul>{o.order_items.map((i,index) => <li key={index}>{i.item_name} · {i.vbucks_price} pavos {i.wallet_refunded ? "· Pavos devueltos" : ""}</li>)}</ul>{o.fulfillments.filter((f) => f.last_error).map((f,index) => <p key={index}>{f.last_error}</p>)}{(() => { const n = orderNotice(o, data?.accounts.find((a) => a.user_id===selected)?.whatsapp); return n && <WhatsappButton href={n.href}>{n.label}</WhatsappButton>; })()}</article>)}</div><h3>Recargas</h3><div className={styles.list}>{details.data?.topups.map((t) => { const account = data?.accounts.find((a) => a.user_id===selected); const n = topupNotice(t, account, account?.balance ?? 0); return <article key={t.id}>{t.vbucks} pavos · {walletMoney(t.amount_cents,t.region)} · {topupLabels[topupStatus(t)]} · {topupReference(t)}<p>{t.review_note}</p>{n && <WhatsappButton href={n.href}>{n.label}</WhatsappButton>}</article>; })}</div><h3>Movimientos</h3><div className={styles.list}>{details.data?.movements.map((m) => <article key={m.id}>{new Date(m.created_at).toLocaleString("es-MX")} · {movementLabels[m.kind]} · {m.delta>0 ? "+" : ""}{m.delta} pavos{m.reason ? ` · ${m.reason}` : ""}</article>)}</div></section>}
    </div></>;
}

function AccountControls({ userId, account, busy, onAction }: { userId: string; account?: Account; busy: boolean; onAction: (body: unknown) => Promise<boolean> }) {
  const [delta,setDelta] = useState("");
  const [reason,setReason] = useState("");
  const [freezeReason,setFreezeReason] = useState("");
  const amount = Number(delta);
  const validAdjust = Number.isInteger(amount) && amount !== 0 && Math.abs(amount) <= 1000000 && reason.trim().length >= 5;
  function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validAdjust) return;
    void onAction({ action:"adjust", userId, delta:amount, reason:reason.trim() }).then((ok) => { if (ok) { setDelta(""); setReason(""); } });
  }
  function freeze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const frozen = !account?.frozen;
    void onAction({ action:"freeze", userId, frozen, reason:freezeReason.trim() }).then((ok) => { if (ok) setFreezeReason(""); });
  }
  return <div className={styles.list}>
    <article>
      <header><h3>Ajustar saldo</h3><strong>Saldo actual: {(account?.balance ?? 0).toLocaleString("es-MX")} pavos</strong></header>
      <p>Usa un número positivo para agregar y negativo para quitar. Queda en el historial con tu usuario y el motivo. El saldo no puede quedar en negativo: si el cliente ya gastó los pavos, congela la cuenta.</p>
      <form onSubmit={adjust}><fieldset disabled={busy}>
        <label>Pavos a ajustar<input id={`adjust-delta-${userId}`} type="number" step={1} min={-1000000} max={1000000} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="Ej. -500 o 250" required /></label>
        <label>Motivo (obligatorio)<input id={`adjust-reason-${userId}`} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Contracargo de PayPal del 18 nov" required /></label>
        <button className="secondary-button" disabled={!validAdjust}>{amount < 0 ? `Quitar ${Math.abs(amount || 0).toLocaleString("es-MX")} pavos` : `Agregar ${(amount || 0).toLocaleString("es-MX")} pavos`}</button>
      </fieldset></form>
    </article>
    <article>
      <header><h3>{account?.frozen ? "Cuenta congelada" : "Congelar cuenta"}</h3>{account?.frozen && <strong>🔒 Sin compras con pavos</strong>}</header>
      <p>{account?.frozen ? `Motivo: ${account.frozen_reason ?? "sin motivo"}. Al descongelarla, el cliente vuelve a poder pagar con pavos.` : "Bloquea las compras con pavos de este cliente, por ejemplo ante un contracargo o si sospechas que le robaron la cuenta. El saldo se conserva."}</p>
      <form onSubmit={freeze}><fieldset disabled={busy}>
        {!account?.frozen && <label>Motivo (obligatorio)<input id={`freeze-reason-${userId}`} maxLength={500} value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} placeholder="Ej. Disputa abierta en PayPal" required /></label>}
        <button className="secondary-button" disabled={!account?.frozen && freezeReason.trim().length < 5}>{account?.frozen ? "Descongelar cuenta" : "Congelar cuenta"}</button>
      </fieldset></form>
      {account?.frozen && <WhatsappButton href={whatsappLink(account.whatsapp, toCustomer.frozen({ reason: account.frozen_reason ?? "revisión de seguridad" }))}>Avisar al cliente por WhatsApp</WhatsappButton>}
    </article>
  </div>;
}
