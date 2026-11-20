"use client";
import { useRef, useState } from "react";
import { walletMoney, type WalletRate } from "../domain/wallet";
import { checkLadder, marginBp, minAllowedPer100, topupQuote, type LadderRow, type WalletTier } from "../domain/wallet-offers";
import styles from "./wallet.module.css";

type Region = "mx" | "us";
type Props = {
  region: Region;
  rate: WalletRate;
  tiers: WalletTier[];
  /** Guarda un escalón; devuelve el error del servidor o null. */
  onSave: (body: unknown) => Promise<string | null>;
  onSaved: () => Promise<void>;
};
const ROWS = 4;
const PREVIEW = [1000, 2800, 5000, 13500];
const n = (value: number) => value.toLocaleString("es-MX");
const percent = (bp: number) => `${(bp / 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`;

function rowsFrom(tiers: WalletTier[]): LadderRow[] {
  const rows: LadderRow[] = tiers.toSorted((a, b) => a.min_vbucks - b.min_vbucks)
    .map((tier) => ({ key: tier.id, id: tier.id, min: String(tier.min_vbucks), price: String(tier.cents_per_100 / 100), active: tier.active !== false }));
  for (let index = rows.length; index < ROWS; index += 1) rows.push({ key: `new-${index}`, id: null, min: "", price: "", active: true });
  return rows;
}

/**
 * Escalera de precio por volumen de una región: la tarifa base y hasta 4 escalones (o más) que
 * se editan juntos. Antes de guardar revisa lo mismo que la base (margen sobre el costo) y además
 * que cada escalón baje de precio. Los errores salen en la fila, no arriba de la página.
 */
export function TierLadder({ region, rate, tiers, onSave, onSaved }: Props) {
  const [rows, setRows] = useState(() => rowsFrom(tiers));
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const added = useRef(ROWS);
  const money = (cents: number) => walletMoney(cents, region);
  const base = rate.cents_per_100 ?? 0;
  const floor = minAllowedPer100(rate);

  const { problems: ladderProblems, steps } = checkLadder(rows, rate, money);
  const problems: Record<string, string> = { ...ladderProblems };
  for (const row of rows) if (row.id && !row.min.trim() && !row.price.trim()) problems[row.key] = "Para quitar este escalón, desmarca «Activo» y guarda.";
  const valid = steps.filter((step) => step.row.active && !problems[step.row.key]);
  const draft: WalletTier[] = valid.map((step) => ({ id: step.row.key, region, min_vbucks: step.min, cents_per_100: step.cents }));
  const previewRate = { ...rate, active: true };
  const amounts = [...new Set([...PREVIEW, ...valid.map((step) => step.min)])].toSorted((a, b) => a - b);

  const original = (row: LadderRow, min: number) => row.id ? tiers.find((tier) => tier.id === row.id) : tiers.find((tier) => tier.min_vbucks === min);
  const changes = steps.filter((step) => {
    const before = original(step.row, step.min);
    return !before || before.min_vbucks !== step.min || before.cents_per_100 !== step.cents || (before.active !== false) !== step.row.active;
  });

  function update(key: string, patch: Partial<LadderRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
    setStatus(null);
    setFailures((current) => Object.fromEntries(Object.entries(current).filter(([failed]) => failed !== key)));
  }
  async function save() {
    setChecked(true);
    if (Object.keys(problems).length) { setStatus({ ok: false, text: "Corrige los escalones marcados antes de guardar." }); return; }
    if (!changes.length) { setStatus({ ok: true, text: "No hay cambios por guardar." }); return; }
    setSaving(true); setStatus(null);
    const failed: Record<string, string> = {};
    // Primero los que se apagan: así un escalón nuevo puede tomar su lugar sin chocar.
    for (const step of changes.toSorted((a, b) => Number(a.row.active) - Number(b.row.active))) {
      const error = await onSave({ action: "tier", id: step.row.id, region, minVbucks: step.min, centsPer100: step.cents, active: step.row.active });
      if (error) failed[step.row.key] = error;
    }
    await onSaved();
    setFailures(failed);
    setSaving(false);
    const saved = changes.length - Object.keys(failed).length;
    setStatus(Object.keys(failed).length
      ? { ok: false, text: `${saved ? `Se guardaron ${saved} escalones. ` : ""}No se pudieron guardar los marcados en rojo.` }
      : { ok: true, text: "Escalera guardada. Aplica a las recargas nuevas." });
  }

  return <div className={styles.ladder}>
    <p className={styles.ladderBase}>
      <strong>Tarifa base: {money(base)} por 100</strong> · la paga quien compra menos que el primer escalón.
      {floor !== null ? <> Precio mínimo permitido: <strong>{money(floor)}</strong> (tu costo {money(rate.cost_cents_per_100!)} + margen {percent(rate.min_margin_bp ?? 0)}).</>
        : <> <span className={styles.marginBad}>Captura tu costo por 100 en la tarifa de arriba para poder activar escalones.</span></>}
    </p>
    <div className={styles.ladderHead} aria-hidden="true"><span>Desde (pavos)</span><span>Precio por 100</span><span>Activo</span><span>Para el cliente</span></div>
    {rows.map((row, index) => {
      const error = failures[row.key] ?? (checked || row.min.trim() && row.price.trim() ? problems[row.key] : undefined);
      const step = valid.find((item) => item.row.key === row.key);
      const margin = step ? marginBp(step.cents, rate.cost_cents_per_100) : null;
      return <div key={row.key} className={styles.ladderRow} data-invalid={Boolean(error) || undefined}>
        <label><span className={styles.ladderLabel}>Desde (pavos)</span>
          <input type="number" inputMode="numeric" min={100} max={50000} step={100} placeholder={index === 0 ? "Ej. 1000" : ""} value={row.min} aria-label={`Escalón ${index + 1}: desde cuántos pavos`} aria-invalid={Boolean(error)} onChange={(event) => update(row.key, { min: event.target.value })} /></label>
        <label><span className={styles.ladderLabel}>Precio por 100</span>
          <input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder={index === 0 && floor !== null ? `Ej. ${(Math.max(floor, base - 50) / 100).toFixed(2)}` : ""} value={row.price} aria-label={`Escalón ${index + 1}: precio por 100 pavos`} aria-invalid={Boolean(error)} onChange={(event) => update(row.key, { price: event.target.value })} /></label>
        <label className={styles.ladderCheck}><span><input type="checkbox" checked={row.active} aria-label={`Escalón ${index + 1}: activo`} onChange={(event) => update(row.key, { active: event.target.checked })} /> Activo</span></label>
        <div className={styles.ladderInfo}>
          {step ? <><span>Ahorra <strong>{percent(Math.round((base - step.cents) / base * 10_000))}</strong> contra la base</span>
            {margin !== null && <small className={styles.marginOk}>Margen {percent(margin)}</small>}</>
            : row.min.trim() && row.price.trim() && !row.active ? <small>Apagado: no se ofrece.</small> : <small>—</small>}
        </div>
        {error && <p className={styles.ladderError} role="alert">{error}</p>}
      </div>;
    })}
    <div className={styles.amountButtons}>
      <button type="button" disabled={saving} onClick={() => { setRows((current) => [...current, { key: `new-${added.current++}`, id: null, min: "", price: "", active: true }]); }}>Agregar otro escalón</button>
      <button type="button" className="secondary-button" disabled={saving} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar escalera"}</button>
    </div>
    {status && <p className={status.ok ? styles.ladderOk : styles.ladderError} role="status">{status.text}</p>}
    <div className={styles.ladderPreview}>
      <h3>Así lo verá el cliente</h3>
      <table>
        <thead><tr><th scope="col">Recarga</th><th scope="col">Paga</th><th scope="col">Por cada 100</th><th scope="col">Ahorro</th></tr></thead>
        <tbody>{amounts.map((amount) => {
          const quote = topupQuote(amount, previewRate, draft);
          if (!quote) return null;
          const cut = base ? Math.round((base - quote.centsPer100) / base * 10_000) : 0;
          return <tr key={amount}><th scope="row">{n(amount)} pavos</th><td>{money(quote.cents)}</td><td>{money(quote.centsPer100)}</td><td>{cut > 0 ? `−${percent(cut)}` : "Base"}</td></tr>;
        })}</tbody>
      </table>
      <small>Vista previa con lo que está escrito arriba, aunque aún no esté guardado. No incluye promociones de regalo.</small>
    </div>
  </div>;
}
