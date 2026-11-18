"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AdminPageHeader } from "@/features/admin/components/admin-shell";
import { useAdminData, useAdminRequest } from "@/features/admin/components/use-admin-request";
import { topupLabels, walletMoney, type WalletMovement, type WalletRate, type WalletTopup } from "../domain/wallet";
import styles from "./wallet.module.css";
type Account = { user_id: string; email: string; balance: number; purchased: number; spent: number; refunded: number };
type WalletOrder = { id: string; status: string; epic_display_name: string; wallet_vbucks: number; created_at: string; order_items: { item_name: string; vbucks_price: number; wallet_refunded: boolean }[]; fulfillments: { status: string; last_error: string | null }[] };
const orderLabels: Record<string,string> = { paid:"Pagado", ready_to_send:"En cola", validating_delivery:"Validando entrega", delivering:"Enviando", reconciling:"Confirmando envío", manual_review:"Requiere atención", delivered:"Entregado / resuelto", refunded:"Pavos devueltos", canceled:"Cancelado" };
export function AdminWallet() {
  const request = useAdminRequest();
  const { data,error,reload } = useAdminData<{ accounts: Account[]; pending: WalletTopup[]; rates: WalletRate[] }>("/api/admin/wallet", { refreshMs: 30000 });
  const [selected,setSelected] = useState<string | null>(null);
  const details = useAdminData<{ movements: WalletMovement[]; orders: WalletOrder[]; topups: WalletTopup[] }>(selected ? `/api/admin/wallet?userId=${selected}` : null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [notes,setNotes] = useState<Record<string,string>>({});
  const [search,setSearch] = useState("");
  async function action(body: unknown) {
    setBusy(true); setMessage("");
    try { await request("/api/admin/wallet", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body) }); setMessage("Cambios guardados."); await reload(); if(selected) await details.reload(); }
    catch(cause) { setMessage(cause instanceof Error ? cause.message : "No fue posible guardar."); }
    finally { setBusy(false); }
  }
  function rate(event: FormEvent<HTMLFormElement>, region: string) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void action({ action:"rate", region, centsPer100:Math.round(Number(form.get("price"))*100), active:form.get("active")==="on" });
  }
  return <><AdminPageHeader title="Clientes con pavos" lead="Saldos de la tienda, recargas y entregas pagadas con pavos." actions={<button className="ac-ghost" onClick={() => void reload()}>Actualizar</button>} />
    {(error || message) && <p className="ac-notice" role="status">{error ?? message}</p>}
    <div className={styles.panel}>
    <section className={styles.recharge}><h2>Tarifas de recarga</h2><p>Precio por cada 100 pavos. Las recargas permanecen bloqueadas hasta activar una tarifa. Las solicitudes ya creadas conservan su precio.</p>
      {data?.rates.map((r) => <form key={`${r.region}-${r.cents_per_100}-${r.active}`} onSubmit={(e) => rate(e,r.region)}><fieldset disabled={busy}><h3>{r.region==="mx" ? "México · MXN" : "USA · USD"}</h3><label>Precio por 100 pavos<input name="price" type="number" min="0.01" max="10000" step="0.01" required defaultValue={r.cents_per_100 ? r.cents_per_100/100 : ""} /></label><label><span><input type="checkbox" name="active" defaultChecked={r.active} /> Habilitar recargas en esta región</span></label><button className="secondary-button">Guardar tarifa</button></fieldset></form>)}
    </section>
    <section><h2>Comprobantes de recargas por revisar ({data?.pending.length ?? 0})</h2><div className={styles.list}>{data?.pending.length===0 && <p>No hay recargas pendientes de revisión.</p>}{data?.pending.map((t) => <article key={t.id}><header><strong>{t.vbucks.toLocaleString("es-MX")} pavos · {walletMoney(t.amount_cents,t.region)}</strong><button className="ac-ghost" onClick={() => setSelected(t.user_id)}>Ver cliente</button></header><p>Recarga #{t.id.slice(0,8)} · {data.accounts.find((a) => a.user_id===t.user_id)?.email ?? t.user_id}</p>{t.receiptUrl ? <a href={t.receiptUrl} target="_blank" rel="noreferrer">Abrir comprobante de pago ↗</a> : <p>No se pudo abrir el comprobante. Actualiza antes de aprobar.</p>}<label>Nota de revisión (obligatoria al rechazar)<input maxLength={1000} value={notes[t.id] ?? ""} onChange={(e) => setNotes({ ...notes,[t.id]:e.target.value })} /></label><div className={styles.amountButtons}><button disabled={busy || !t.receiptUrl} onClick={() => void action({ action:"review",id:t.id,approve:true,note:notes[t.id] ?? "" })}>Confirmar pago y acreditar pavos</button><button disabled={busy || (notes[t.id]?.trim().length ?? 0)<5} onClick={() => void action({ action:"review",id:t.id,approve:false,note:notes[t.id] })}>Rechazar recarga</button></div></article>)}</div></section>
    <section><h2>Saldos de clientes</h2><label>Buscar entre los últimos 500 clientes<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Correo o ID del cliente" /></label><div className={styles.list}>{data?.accounts.filter((a) => `${a.email} ${a.user_id}`.toLowerCase().includes(search.toLowerCase())).map((a) => <article key={a.user_id}><header><strong>{a.email || a.user_id}</strong><strong>{a.balance.toLocaleString("es-MX")} disponibles</strong></header><p>Comprados: {Number(a.purchased).toLocaleString("es-MX")} · Utilizados: {Number(a.spent).toLocaleString("es-MX")} · Devueltos: {Number(a.refunded).toLocaleString("es-MX")}</p><button className="ac-ghost" onClick={() => setSelected(a.user_id)}>Ver recargas, movimientos y envíos</button></article>)}</div></section>
    {selected && <section aria-label="Detalle del cliente"><h2>Historial: {data?.accounts.find((a) => a.user_id===selected)?.email ?? selected}</h2>{details.error && <p role="alert">{details.error}</p>}<p>Últimos 200 registros de cada tipo.</p><h3>Envíos con pavos</h3><div className={styles.list}>{details.data?.orders.map((o) => <article key={o.id}><header><Link href={`/admin/pedidos/${o.id}`}>Pedido #{o.id.slice(0,8)} · {o.epic_display_name}</Link><strong>{orderLabels[o.status] ?? o.status}</strong></header><p>{new Date(o.created_at).toLocaleString("es-MX")} · {o.wallet_vbucks.toLocaleString("es-MX")} pavos</p><ul>{o.order_items.map((i,index) => <li key={index}>{i.item_name} · {i.vbucks_price} pavos {i.wallet_refunded ? "· Pavos devueltos" : ""}</li>)}</ul>{o.fulfillments.filter((f) => f.last_error).map((f,index) => <p key={index}>{f.last_error}</p>)}</article>)}</div><h3>Recargas</h3><div className={styles.list}>{details.data?.topups.map((t) => <article key={t.id}>{t.vbucks} pavos · {walletMoney(t.amount_cents,t.region)} · {topupLabels[t.status]}<p>{t.review_note}</p></article>)}</div><h3>Movimientos</h3><div className={styles.list}>{details.data?.movements.map((m) => <article key={m.id}>{new Date(m.created_at).toLocaleString("es-MX")} · {m.kind==="topup" ? "Recarga" : m.kind==="refund" ? "Devolución" : "Compra"} · {m.delta>0 ? "+" : ""}{m.delta} pavos</article>)}</div></section>}
    </div></>;
}
