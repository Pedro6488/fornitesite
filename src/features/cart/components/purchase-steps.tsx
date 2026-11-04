import { Check } from "lucide-react";

const STEPS = ["Carrito", "ID y precio", "Contacto y orden"] as const;

/** Progreso de compra compartido por carrito y checkout. */
export function PurchaseSteps({ current }: { current: 1 | 2 | 3 }) {
  return <ol className="purchase-steps" aria-label="Progreso de compra">
    {STEPS.map((step, index) => {
      const number = index + 1;
      const state = number < current ? "complete" : number === current ? "active" : "";
      return <li className={state} aria-current={number === current ? "step" : undefined} key={step}>
        <b>{number < current ? <Check aria-hidden="true" size={13} strokeWidth={3} /> : number}</b>
        <span>{step}</span>
      </li>;
    })}
  </ol>;
}
