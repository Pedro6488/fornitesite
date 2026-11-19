import { ChevronDown, Gift, RotateCcw, ShieldCheck, Zap } from "lucide-react";
import styles from "./wallet-explainer.module.css";

/**
 * Piezas para explicar los pavos de la tienda en la portada y en /pavos.
 * Todo lo que se promete aquí lo cumple el sistema: entrega automática al pagar con saldo,
 * devolución al instante si un objeto no se envía, y descuento o regalo solo cuando hay
 * tramos o promociones vigentes (los muestra WalletOfferBadge con datos reales).
 */

export const walletBenefits = [
  { icon: Zap, title: "Entrega al instante", text: "Pagas con tu saldo y el envío empieza solo. Sin subir comprobante ni esperar a que revisemos el pago de cada pedido." },
  { icon: Gift, title: "Más pavos por tu dinero", text: "Las recargas grandes pueden salir más baratas por cada 100, y en temporada de promoción te regalamos pavos extra." },
  { icon: RotateCcw, title: "Tu saldo, de vuelta", text: "Si un objeto no se puede enviar, sus pavos regresan a tu saldo al momento, sin trámites." },
  { icon: ShieldCheck, title: "Sin tu contraseña", text: "Solo usamos tu ID de Fortnite para regalarte los objetos. Tu cuenta de Epic no se toca." },
] as const;

export function WalletBenefits({ compact = false }: { compact?: boolean }) {
  return <ul className={`${styles.benefits} ${compact ? styles.compact : ""}`}>
    {walletBenefits.map(({ icon: Icon, title, text }) => <li key={title}><Icon aria-hidden="true" size={22} /><strong>{title}</strong><p>{text}</p></li>)}
  </ul>;
}

const regularFlow = ["Eliges tus objetos", "Transfieres o pagas por PayPal", "Subes el comprobante", "Esperas a que lo confirmemos", "Se envía a tu ID"];
const walletFlow = ["Eliges tus objetos", "Pagas con tu saldo", "Se envía a tu ID al instante"];

/** Comparación de flujos: es la razón principal para tener saldo. */
export function WalletCompare() {
  return <div className={styles.compare}>
    <section aria-labelledby="flow-regular">
      <header><h3 id="flow-regular">Pago habitual</h3><span>En cada pedido</span></header>
      <ol>{regularFlow.map((step) => <li key={step}>{step}</li>)}</ol>
    </section>
    <section className={styles.fast} aria-labelledby="flow-wallet">
      <header><h3 id="flow-wallet">Con pavos</h3><span>Después de tu primera recarga</span></header>
      <ol>{walletFlow.map((step) => <li key={step}>{step}</li>)}</ol>
      <p><Zap aria-hidden="true" size={16} /> Confirmamos tu pago una sola vez, al recargar. Desde ahí, cada compra sale sola.</p>
    </section>
  </div>;
}

export const walletSteps = [
  { title: "Elige tu recarga", text: "De 100 a 50,000 pavos. Ves el total y el regalo antes de comprar." },
  { title: "Paga y sube tu comprobante", text: "Transferencia en México o PayPal en USA, con tu referencia RECARGA-… en el concepto." },
  { title: "Confirmamos tu pago", text: "Revisamos la referencia, acreditamos tu saldo y te avisamos por WhatsApp." },
  { title: "Compra al instante", text: "En el checkout elige “Mis pavos de la tienda”: el envío empieza solo." },
] as const;

export type WalletStepState = "done" | "current" | "todo";

export function WalletSteps({ current }: { current?: number }) {
  return <ol className={styles.steps}>
    {walletSteps.map((step, index) => {
      const state: WalletStepState | undefined = current === undefined ? undefined : index < current ? "done" : index === current ? "current" : "todo";
      return <li key={step.title} data-state={state} aria-current={state === "current" ? "step" : undefined}>
        <span className={styles.stepNumber}>{state === "done" ? "✓" : String(index + 1).padStart(2, "0")}</span>
        <strong>{step.title}</strong><p>{step.text}</p>
      </li>;
    })}
  </ol>;
}

const questions = [
  { question: "¿Qué son los pavos de la tienda?", answer: "Es tu saldo en SigfriedLootBox. Un pavo de la tienda paga un pavo del precio del objeto en Fortnite: un atuendo de 1,200 pavos cuesta 1,200 de tu saldo." },
  { question: "¿Son paVos de mi cuenta de Epic?", answer: "No. No se cargan en tu cuenta de Epic: se quedan en tu cuenta de SigfriedLootBox y los usas aquí para que te regalemos objetos a tu ID de Fortnite." },
  { question: "¿Cuándo se acredita mi recarga?", answer: "En cuanto confirmamos tu pago con la referencia de la recarga. Te avisamos por WhatsApp. Si no subes el comprobante en 48 horas, la recarga vence y puedes crear otra." },
  { question: "¿Qué pasa si un objeto no se puede enviar?", answer: "Los pavos de ese objeto regresan a tu saldo al momento. Lo ves en tu pedido y en tus movimientos, y puedes usarlos en la siguiente compra." },
  { question: "¿Siempre conviene pagar con pavos?", answer: "La entrega siempre es más rápida. En precio depende del objeto y de tu recarga: en el checkout te mostramos si con pavos ahorras o si el pago habitual sale más barato." },
  { question: "¿Puedo combinar pavos con otro pago?", answer: "No. Cada pedido se paga completo con un solo método: tu saldo, o transferencia o PayPal." },
] as const;

export function WalletFaq() {
  return <div className={styles.faq}>{questions.map(({ question, answer }) => <details key={question}><summary>{question}<ChevronDown size={18} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>;
}

/** Tarjeta ilustrativa: saldo y una compra pagada con pavos. Decorativa. */
export function WalletPreviewCard({ balance, label = "Tu saldo" }: { balance?: string; label?: string }) {
  return <div className={styles.card} aria-hidden="true">
    <div className={styles.cardTop}><small>{label}</small><strong>{balance ?? "5,250"}</strong><span>pavos de la tienda</span></div>
    <div className={styles.receipt}>
      <span>Atuendo · 1,200 pavos</span>
      <b>✓ Pagado con pavos</b>
      <span className={styles.sending}><Zap size={14} /> Enviando a tu ID…</span>
    </div>
  </div>;
}

/** Lo que pasa después de pulsar "Comprar pavos": quién hace qué. */
export const walletAfterBuy = [
  { who: "Nosotros", text: "Te damos los datos de pago y tu referencia RECARGA-…" },
  { who: "Tú", text: "Pagas el monto exacto con la referencia y subes el comprobante (tienes 48 horas)." },
  { who: "Nosotros", text: "Confirmamos el pago, acreditamos tus pavos y te avisamos por WhatsApp." },
  { who: "Tú", text: "Eliges objetos y pagas con “Mis pavos de la tienda”: se envían solos a tu ID." },
] as const;

export function WalletAfterBuy() {
  return <ol className={styles.after} aria-label="Qué pasa después">
    {walletAfterBuy.map((item, index) => <li key={index} data-who={item.who === "Tú" ? "you" : "us"}><b>{item.who}</b><span>{item.text}</span></li>)}
  </ol>;
}

/** Qué necesitas y qué nunca te pedimos. */
export function WalletRequirements() {
  return <div className={styles.requirements}>
    <section aria-labelledby="req-need"><h3 id="req-need">Lo único que necesitas</h3><ul>
      <li>Tu ID de Fortnite (Epic) para que te regalemos los objetos.</li>
      <li>Aceptar la solicitud de amistad de nuestra cuenta. Epic pide 48 horas de amistad antes del primer regalo; después, cada envío es inmediato.</li>
      <li>Una cuenta en SigfriedLootBox para guardar tu saldo.</li>
    </ul></section>
    <section className={styles.never} aria-labelledby="req-never"><h3 id="req-never">Lo que nunca te pedimos</h3><ul>
      <li>Tu correo ni tu contraseña de Epic, ni que nos des acceso a tu cuenta.</li>
      <li>Cambiar la región de tu cuenta.</li>
      <li>Que te quedes conectado mientras enviamos: el regalo llega solo.</li>
    </ul></section>
  </div>;
}
