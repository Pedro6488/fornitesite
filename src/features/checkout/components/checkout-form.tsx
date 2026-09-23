"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { formatMxn } from "@/features/pricing/domain/price-calculator";

export function CheckoutForm({ item, receiver, receiverId }: { item: CatalogItem; receiver: string; receiverId: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<"mercado_pago" | "bank_transfer">("mercado_pago");
  const [email, setEmail] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(null);
    const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemMainId: item.mainId, customerEmail: email, epicAccountId: receiverId, epicDisplayName: receiver, paymentMethod: method }) });
    const body = await response.json();
    if (!response.ok) { setLoading(false); setError(body.error ?? "No fue posible crear el pedido."); return; }
    if (method === "mercado_pago") {
      const checkout = await fetch(`/api/orders/${body.order.id}/mercado-pago`, { method: "POST" }); const result = await checkout.json();
      if (!checkout.ok) { setLoading(false); setError(result.error); return; }
      window.location.assign(result.checkoutUrl); return;
    }
    router.push(`/pedidos/${body.order.id}?access=${body.order.publicToken}`);
  }

  return <form className="checkout-card" onSubmit={submit}>
    <div className="order-summary"><div><p className="eyebrow">OBJETO SELECCIONADO</p><h2>{item.name}</h2><span>Para {receiver}</span></div><strong>{item.priceMxn === null ? "—" : formatMxn(item.priceMxn)}</strong></div>
    <label>Correo para seguimiento<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>
    <fieldset><legend>Método de pago</legend><label className={`method-card ${method === "mercado_pago" ? "selected" : ""}`}><input type="radio" name="method" value="mercado_pago" checked={method === "mercado_pago"} onChange={() => setMethod("mercado_pago")} /><span><strong>Mercado Pago</strong><small>Validación automática</small></span></label><label className={`method-card ${method === "bank_transfer" ? "selected" : ""}`}><input type="radio" name="method" value="bank_transfer" checked={method === "bank_transfer"} onChange={() => setMethod("bank_transfer")} /><span><strong>Transferencia</strong><small>Revisión manual de hasta 15 minutos</small></span></label></fieldset>
    {error && <p className="notice error">{error}</p>}<button className="primary-button" disabled={loading}>{loading ? "Preparando…" : method === "mercado_pago" ? "Pagar con Mercado Pago" : "Ver datos de transferencia"}</button>
  </form>;
}
