"use client";
import type { CSSProperties, ReactNode } from "react";
import { ArrowDown, Gift, Minus, Plus } from "lucide-react";
import { useStoreRegion, type StoreRegion } from "@/features/pricing/components/region-provider";
import { walletMoney } from "../domain/wallet";
import { nextOffer, topupQuote, WALLET_MAX, WALLET_MIN, type PublicWalletOffers, type TopupQuote } from "../domain/wallet-offers";
import styles from "./wallet-calculator.module.css";

const PRESETS = [1000, 2800, 5000, 13500];
const n = (value: number) => value.toLocaleString("es-MX");
const clamp = (value: number) => Math.min(WALLET_MAX, Math.max(WALLET_MIN, Math.round(value / 100) * 100));
/**
 * La barra usa escala cuadrática: de 100 a ~13,500 (donde están casi todas las recargas)
 * ocupa la mitad del recorrido, en lugar de un cuarto con una escala lineal.
 */
export const SLIDER_STEPS = 1000;
export const toSlider = (amount: number) => Math.round(Math.sqrt((amount - WALLET_MIN) / (WALLET_MAX - WALLET_MIN)) * SLIDER_STEPS);
export const fromSlider = (value: number) => clamp(WALLET_MIN + (value / SLIDER_STEPS) ** 2 * (WALLET_MAX - WALLET_MIN));
const position = (value: number) => toSlider(value) / SLIDER_STEPS * 100;
const chipMoney = (cents: number, region: StoreRegion) => (cents / 100).toLocaleString(region === "us" ? "en-US" : "es-MX", { style: "currency", currency: region === "us" ? "USD" : "MXN", currencyDisplay: "narrowSymbol", minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Equivalencia para darle sentido a la cifra: 1 pavo de la tienda = 1 pavo del precio en Fortnite. */
const examples = [
  { min: 1500, price: 1500, one: "atuendo de 1,500", many: "atuendos de 1,500" },
  { min: 500, price: 500, one: "gesto de 500", many: "gestos de 500" },
  { min: 200, price: 200, one: "gesto de 200", many: "gestos de 200" },
];
export function walletExample(credited: number) {
  const pick = examples.find((example) => credited >= example.min);
  if (!pick) return null;
  const count = Math.floor(credited / pick.price);
  return `${count} ${count === 1 ? pick.one : pick.many}`;
}

type Source = Pick<PublicWalletOffers, "rates" | "tiers" | "bonuses"> | null | undefined;
type Props = {
  amount: number;
  onAmount: (value: number) => void;
  source: Source;
  /** "compact" para la portada: apilado y con selector de región propio. */
  variant?: "page" | "compact";
  disabled?: boolean;
  /** Botón de compra y lo que va debajo del recibo. */
  children?: (quote: TopupQuote | null) => ReactNode;
  /** Contenido bajo los controles (en móvil queda después del recibo). */
  aside?: ReactNode;
};

export function WalletCalculator({ amount, onAmount, source, variant = "page", disabled = false, children, aside }: Props) {
  const { region, setRegion } = useStoreRegion();
  const rate = source?.rates.find((item) => item.region === region);
  const tiers = (source?.tiers ?? []).filter((tier) => tier.region === region);
  const bonuses = (source?.bonuses ?? []).filter((bonus) => bonus.region === region);
  const quote = topupQuote(amount, rate, tiers, bonuses);
  const next = nextOffer(amount, rate, tiers, bonuses);
  const credited = quote?.credited ?? amount;
  const example = walletExample(credited);

  // Escalones reales (tramos y promociones) más cantidades típicas, sin repetir.
  const steps = [...new Set([...PRESETS, ...tiers.map((t) => t.min_vbucks), ...bonuses.map((b) => b.min_vbucks)])].toSorted((a, b) => a - b).slice(0, 7);
  const chipNote = (value: number) => {
    const chip = topupQuote(value, rate, tiers, bonuses);
    if (!chip) return null;
    if (chip.bonus > 0) return `+${n(chip.bonus)} 🎁`;
    return chipMoney(chip.cents, region);
  };
  const markers = [...new Set([...tiers.map((t) => t.min_vbucks), ...bonuses.map((b) => b.min_vbucks)])];

  return <div className={`${styles.calc} ${variant === "compact" ? styles.compact : ""}`}>
    <div className={styles.controls}>
      {variant === "compact" && <div className={styles.region} role="group" aria-label="Región de pago">
        {(["mx", "us"] as StoreRegion[]).map((value) => <button key={value} type="button" aria-pressed={region === value} onClick={() => setRegion(value)}>{value === "mx" ? "México · MXN" : "USA · USD"}</button>)}
      </div>}
      <label htmlFor={`wallet-range-${variant}`} className={styles.label}>¿Cuántos pavos quieres?</label>
      <div className={styles.amountRow}>
        <button type="button" className={styles.step} aria-label="Quitar 500 pavos" disabled={disabled || amount <= WALLET_MIN} onClick={() => onAmount(clamp(amount - 500))}><Minus size={18} aria-hidden="true" /></button>
        <output htmlFor={`wallet-range-${variant}`} className={styles.amount} aria-live="polite">{n(amount)}<small>pavos</small></output>
        <button type="button" className={styles.step} aria-label="Agregar 500 pavos" disabled={disabled || amount >= WALLET_MAX} onClick={() => onAmount(clamp(amount + 500))}><Plus size={18} aria-hidden="true" /></button>
      </div>
      <div className={styles.track}>
        <input id={`wallet-range-${variant}`} type="range" min={0} max={SLIDER_STEPS} step={1} value={toSlider(amount)} disabled={disabled}
          style={{ "--fill": `${position(amount)}%` } as CSSProperties} onChange={(event) => onAmount(fromSlider(Number(event.target.value)))} aria-valuetext={`${n(amount)} pavos`} />
        {markers.map((value) => <span key={value} className={styles.marker} data-reached={amount >= value || undefined} style={{ left: `${position(value)}%` }} aria-hidden="true" />)}
      </div>
      <div className={styles.chips}>{steps.map((value) => { const note = chipNote(value); return <button type="button" key={value} aria-pressed={amount === value} disabled={disabled} onClick={() => onAmount(value)}><strong>{n(value)}</strong>{note && <small>{note}</small>}</button>; })}</div>
    </div>

    <div className={styles.receipt}>
      <div className={styles.pay}><small>Pagas {region === "mx" ? "por transferencia" : "por PayPal"}</small><strong key={quote?.cents ?? "none"}>{quote ? walletMoney(quote.cents, region) : "Precio por definir"}</strong></div>
      <ArrowDown className={styles.arrow} size={20} aria-hidden="true" />
      <div className={styles.get}><small>Recibes en tu saldo</small><strong key={credited}>{n(credited)}</strong><span>pavos de la tienda</span>
        {quote && quote.bonus > 0 && <em><Gift size={14} aria-hidden="true" /> {n(amount)} + {n(quote.bonus)} de regalo</em>}</div>
      <ul className={styles.facts}>
        {quote && (quote.tier || quote.bonus > 0) && <li>Te sale en <strong>{walletMoney(Math.round(quote.effectivePer100), region)} por cada 100</strong></li>}
        {example && <li>Alcanza para <strong>{example}</strong></li>}
        {!quote && <li>Las recargas de tu región abren muy pronto. Mientras, puedes comprar con el pago habitual.</li>}
      </ul>
      {next && <p className={styles.next}>Agrega <strong>{n(next.add)} pavos</strong> y {next.quote.bonus > (quote?.bonus ?? 0) ? <>recibes <strong>+{n(next.quote.bonus)} de regalo</strong></> : <>baja a <strong>{walletMoney(next.quote.centsPer100, region)} por 100</strong></>}. <button type="button" disabled={disabled} onClick={() => onAmount(next.target)}>Subir a {n(next.target)}</button></p>}
      {children?.(quote)}
    </div>
    {aside && <div className={styles.aside}>{aside}</div>}
  </div>;
}
