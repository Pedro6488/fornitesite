import Link from "next/link";
import { WALLET_MAX, WALLET_MIN } from "../domain/wallet-offers";
import styles from "./wallet-meter.module.css";

const n = (value: number) => value.toLocaleString("es-MX");

/** Recarga sugerida para cubrir lo que falta: múltiplo de 100 dentro de los límites de recarga. */
export function topupToCover(missing: number) {
  return Math.min(WALLET_MAX, Math.max(WALLET_MIN, Math.ceil(missing / 100) * 100));
}

/**
 * Cuánto tienes, cuánto se descuenta y cuánto te queda, con una barra. Si no alcanza, dice cuánto
 * falta y lleva a recargar justo esa cantidad.
 */
export function WalletMeter({ balance, cost, label = "Este pedido" }: { balance: number; cost: number; label?: string }) {
  const after = balance - cost;
  const short = after < 0;
  const filled = short
    ? (cost > 0 ? Math.round((balance / cost) * 100) : 0)
    : (balance > 0 ? Math.round(((balance - cost) / balance) * 100) : 0);
  const topup = short ? topupToCover(-after) : 0;
  const description = short
    ? `Tu saldo cubre ${filled}% de ${label.toLowerCase()}; te faltan ${n(-after)} pavos.`
    : `${label} usa ${100 - filled}% de tu saldo; te quedan ${n(after)} pavos.`;
  return <div className={styles.meter} data-short={short || undefined}>
    <dl>
      <div><dt>Tienes</dt><dd>{n(balance)}</dd></div>
      <div className={styles.minus}><dt>{label}</dt><dd>−{n(cost)}</dd></div>
      <div className={styles.after}><dt>{short ? "Te faltan" : "Te quedan"}</dt><dd>{n(Math.abs(after))}</dd></div>
    </dl>
    <div className={styles.bar} role="img" aria-label={description}>
      <span className={styles.fill} style={{ width: `${filled}%` }} />
    </div>
    <small className={styles.legend}>{short ? <span>Tu saldo cubre <strong>{filled}%</strong>. Recarga y vuelve a este pedido.</span> : <><span className={styles.keepDot} aria-hidden="true" /> Lo que te queda <span className={styles.useDot} aria-hidden="true" /> Lo que se descuenta</>}</small>
    {short && <Link className={styles.topup} href={`/pavos?cantidad=${topup}#recargar`}>Recargar {n(topup)} pavos</Link>}
  </div>;
}
