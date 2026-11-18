"use client";
import { useState, type FormEvent } from "react";
import { walletMoney, type WalletRate } from "../domain/wallet";
import { effectiveWithBonus, marginBp, type WalletBonus, type WalletTier } from "../domain/wallet-offers";
import { toCustomer } from "../domain/wallet-whatsapp";
import styles from "./wallet.module.css";

type Region = "mx" | "us";
type Props = { rates: WalletRate[]; tiers: WalletTier[]; bonuses: WalletBonus[]; busy: boolean; onAction: (body: unknown) => Promise<boolean> };
const regionLabel = (region: Region) => region === "mx" ? "México · MXN" : "USA · USD";
const percent = (bp: number | null) => bp === null ? "—" : `${(bp / 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`;
const toLocalInput = (iso: string) => { const date = new Date(iso); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };

/** Margen de un precio por 100 contra el costo y el mínimo de su región. */
function MarginChip({ effective, rate }: { effective: number; rate: WalletRate | undefined }) {
  const margin = marginBp(effective, rate?.cost_cents_per_100);
  if (margin === null) return <small className={styles.marginBad}>Sin costo capturado</small>;
  const ok = margin >= (rate?.min_margin_bp ?? 0);
  return <small className={ok ? styles.marginOk : styles.marginBad}>Margen {percent(margin)}{ok ? "" : ` · debajo del mínimo (${percent(rate?.min_margin_bp ?? 0)})`}</small>;
}

/** Peor caso de un bono: el precio más bajo que puede alcanzar desde su mínimo, con el bono completo. */
function worstBonusPer100(bonus: Pick<WalletBonus, "region" | "min_vbucks" | "bonus_bp">, rate: WalletRate | undefined, tiers: WalletTier[]) {
  if (!rate?.cents_per_100) return null;
  const active = tiers.filter((tier) => tier.region === bonus.region && tier.active !== false);
  const atMin = active.filter((tier) => tier.min_vbucks <= bonus.min_vbucks).toSorted((a, b) => b.min_vbucks - a.min_vbucks)[0]?.cents_per_100 ?? rate.cents_per_100;
  const lowest = Math.min(atMin, ...active.filter((tier) => tier.min_vbucks > bonus.min_vbucks).map((tier) => tier.cents_per_100));
  return effectiveWithBonus(lowest, bonus.bonus_bp);
}

export function AdminWalletOffers({ rates, tiers, bonuses, busy, onAction }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  // Hora de referencia para "vigente": se toma al abrir la pantalla (el panel se recarga cada 30 s).
  const [now] = useState(() => Date.now());
  const rateOf = (region: Region) => rates.find((rate) => rate.region === region);
  function saveTier(event: FormEvent<HTMLFormElement>, id: string | null) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void onAction({ action: "tier", id, region: form.get("region"), minVbucks: Number(form.get("min")), centsPer100: Math.round(Number(form.get("price")) * 100), active: form.get("active") === "on" })
      .then((ok) => { if (ok && !id) (event.target as HTMLFormElement).reset(); });
  }
  function saveBonus(event: FormEvent<HTMLFormElement>, id: string | null) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cap = String(form.get("cap") ?? "").trim();
    const starts = String(form.get("starts") ?? "");
    void onAction({
      action: "bonus", id, region: form.get("region"), label: String(form.get("label") ?? ""), minVbucks: Number(form.get("min")),
      bonusBp: Math.round(Number(form.get("percent")) * 100), bonusCap: cap ? Number(cap) : null, firstTopupOnly: form.get("first") === "on",
      startsAt: starts ? new Date(starts).toISOString() : null, endsAt: new Date(String(form.get("ends"))).toISOString(), active: form.get("active") === "on",
    }).then((ok) => { if (ok && !id) (event.target as HTMLFormElement).reset(); });
  }
  async function copy(id: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); }
    catch { setCopied(`${id}:manual`); }
  }

  const tierFields = (tier?: WalletTier) => <>
    <label>Región<select name="region" defaultValue={tier?.region ?? "mx"}><option value="mx">México · MXN</option><option value="us">USA · USD</option></select></label>
    <label>Desde (pavos)<input name="min" type="number" min={100} max={50000} step={100} required defaultValue={tier?.min_vbucks ?? ""} /></label>
    <label>Precio por 100<input name="price" type="number" min="0.01" step="0.01" required defaultValue={tier ? tier.cents_per_100 / 100 : ""} /></label>
    <label><span><input type="checkbox" name="active" defaultChecked={tier?.active ?? true} /> Activo</span></label>
  </>;
  const bonusFields = (bonus?: WalletBonus) => <>
    <label>Nombre de la promoción<input name="label" maxLength={80} required defaultValue={bonus?.label ?? ""} placeholder="Ej. Noviembre +5%" /></label>
    <label>Región<select name="region" defaultValue={bonus?.region ?? "mx"}><option value="mx">México · MXN</option><option value="us">USA · USD</option></select></label>
    <label>Desde (pavos)<input name="min" type="number" min={100} max={50000} step={100} required defaultValue={bonus?.min_vbucks ?? ""} /></label>
    <label>Regalo (%)<input name="percent" type="number" min="0.01" max="50" step="0.01" required defaultValue={bonus ? bonus.bonus_bp / 100 : ""} /></label>
    <label>Tope de regalo (pavos, opcional)<input name="cap" type="number" min={1} step={1} defaultValue={bonus?.bonus_cap ?? ""} /></label>
    <label>Empieza<input name="starts" type="datetime-local" defaultValue={bonus?.starts_at ? toLocalInput(bonus.starts_at) : ""} /></label>
    <label>Termina<input name="ends" type="datetime-local" required defaultValue={bonus ? toLocalInput(bonus.ends_at) : ""} /></label>
    <label><span><input type="checkbox" name="first" defaultChecked={bonus?.first_topup_only ?? false} /> Solo primera recarga</span></label>
    <label><span><input type="checkbox" name="active" defaultChecked={bonus?.active ?? true} /> Activa</span></label>
  </>;

  return <>
    <section className={styles.recharge}>
      <h2>Precio por volumen</h2>
      <p>Mientras más pavos compra el cliente, menos paga por cada 100. Se aplica el tramo más alto que alcanza la recarga; debajo del primero se cobra la tarifa base. No se puede activar un tramo debajo del margen mínimo.</p>
      <div className={styles.list}>
        {tiers.length === 0 && <p>Aún no hay tramos. Sin tramos, todas las recargas pagan la tarifa base.</p>}
        {tiers.map((tier) => <form key={`${tier.id}-${tier.updated_at ?? ""}`} onSubmit={(event) => saveTier(event, tier.id)}><fieldset disabled={busy} className={styles.offerRow}>
          <header><strong>{regionLabel(tier.region)} · desde {tier.min_vbucks.toLocaleString("es-MX")} pavos: {walletMoney(tier.cents_per_100, tier.region)} por 100</strong><MarginChip effective={tier.cents_per_100} rate={rateOf(tier.region)} /></header>
          {tierFields(tier)}<button className="secondary-button">Guardar tramo</button>
        </fieldset></form>)}
        <form onSubmit={(event) => saveTier(event, null)}><fieldset disabled={busy} className={styles.offerRow}><header><strong>Nuevo tramo</strong></header>{tierFields()}<button className="secondary-button">Agregar tramo</button></fieldset></form>
      </div>
    </section>
    <section className={styles.recharge}>
      <h2>Promociones: pavos de regalo</h2>
      <p>Regalo en porcentaje sobre la recarga, con fecha de fin. Si aplican varias, el cliente recibe la mayor; no se suman. El regalo se fija al crear la recarga y se acredita al aprobarla. El margen se revisa en el peor caso: el tramo más barato que puede alcanzar, con el regalo completo.</p>
      <div className={styles.list}>
        {bonuses.length === 0 && <p>No hay promociones.</p>}
        {bonuses.map((bonus) => {
          const worst = worstBonusPer100(bonus, rateOf(bonus.region), tiers);
          const live = bonus.active !== false && new Date(bonus.ends_at).getTime() > now && (!bonus.starts_at || new Date(bonus.starts_at).getTime() <= now);
          const message = toCustomer.campaign({ label: bonus.label, minVbucks: bonus.min_vbucks, bonusBp: bonus.bonus_bp, cap: bonus.bonus_cap, endsAt: bonus.ends_at, firstTopupOnly: bonus.first_topup_only, appUrl: typeof window === "undefined" ? "" : window.location.origin });
          return <form key={`${bonus.id}-${bonus.ends_at}-${String(bonus.active)}`} onSubmit={(event) => saveBonus(event, bonus.id)}><fieldset disabled={busy} className={styles.offerRow}>
            <header><strong>{bonus.label} · {regionLabel(bonus.region)} · +{percent(bonus.bonus_bp)} desde {bonus.min_vbucks.toLocaleString("es-MX")}</strong><span>{live ? "🟢 Vigente" : bonus.active === false ? "Desactivada" : "Fuera de vigencia"}</span></header>
            {worst !== null && <p>Peor caso: {walletMoney(Math.round(worst), bonus.region)} efectivos por 100 <MarginChip effective={worst} rate={rateOf(bonus.region)} /></p>}
            {bonusFields(bonus)}<button className="secondary-button">Guardar promoción</button>
            {live && <div className={styles.copyBox}><label>Mensaje para tu lista de difusión de WhatsApp<textarea id={`campaign-${bonus.id}`} readOnly rows={6} value={message} onFocus={(event) => event.currentTarget.select()} /></label>
              <button type="button" className="ac-ghost" onClick={() => void copy(bonus.id, message)}>{copied === bonus.id ? "Copiado ✓" : "Copiar mensaje"}</button>
              {copied === `${bonus.id}:manual` && <small>No se pudo copiar automáticamente: selecciona el texto y cópialo.</small>}</div>}
          </fieldset></form>;
        })}
        <form onSubmit={(event) => saveBonus(event, null)}><fieldset disabled={busy} className={styles.offerRow}><header><strong>Nueva promoción</strong></header>{bonusFields()}<button className="secondary-button">Crear promoción</button></fieldset></form>
      </div>
    </section>
  </>;
}
