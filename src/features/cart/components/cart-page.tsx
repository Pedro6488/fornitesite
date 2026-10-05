"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { SystemActionBar } from "@/shared/components/system-action-bar";

export function CartPage({ items }: { items: readonly CatalogItem[] }) {
  const commerce = useCommerceState();
  const [message, setMessage] = useState<string | null>(null);
  const lines = useMemo(() => commerce.cartItemIds.flatMap((id) => { const item = items.find((candidate) => candidate.mainId === id); return item ? [{ item }] : []; }), [commerce.cartItemIds, items]);
  const total = lines.reduce((sum, line) => sum + (line.item.priceMxn ?? 0), 0);
  const canContinue = lines.length > 0 && lines.every(({ item }) => item.priceMxn !== null && item.offerId && item.giftable);
  const idSubmitted = commerce.validation?.status === "manual_review" || commerce.validation?.status === "ready";
  async function remove(itemId: string) { setMessage(await commerce.removeCartItem(itemId)); }

  return <section className="cart-page">
    <header className="cart-heading"><div><p className="eyebrow">TU CARRITO</p><h1>Tu selección</h1><p>{lines.length === 1 ? "1 objeto listo para continuar." : `${lines.length} objetos listos para continuar.`}</p></div><span><ShieldCheck aria-hidden="true" size={18} />Compra protegida y precio confirmado antes de pagar</span></header>
    {!commerce.ready ? <div className="cart-empty"><h2>Cargando tu carrito…</h2></div> : lines.length === 0 ? <div className="cart-empty"><h2>Tu carrito está vacío</h2><p>Explora los objetos disponibles y agrega los que quieras solicitar.</p><Link href="/#catalogo">Ver tienda</Link></div> : <div className="cart-layout">
      <div className="cart-lines">
        {lines.map(({ item }) => <article className="cart-line" key={item.mainId}>
          <Link className="cart-product-link" href={`/objetos/${encodeURIComponent(item.mainId)}`}>
            <div className="cart-item-image">{item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="(max-width: 600px) 72px, 88px" /> : <span aria-hidden="true">{item.name.slice(0, 1)}</span>}</div>
            <div className="cart-item-copy"><p>{item.type} · {item.rarity}</p><h2>{item.name}</h2><span>◉ {item.finalPriceVbucks.toLocaleString("es-MX")} · 1 unidad</span></div>
          </Link>
          <div className="cart-line-price"><strong>{item.priceMxn === null ? "Consultar" : formatMxn(item.priceMxn)}</strong><span>MXN</span></div>
          <button className="cart-remove" onClick={() => void remove(item.mainId)} aria-label={`Quitar ${item.name} del carrito`}><Trash2 aria-hidden="true" size={16} /><span>Eliminar</span></button>
        </article>)}
        {message && <p className="notice error">{message}</p>}
      </div>
      <aside className="cart-summary">
        <div className="cart-summary-heading"><div><p className="eyebrow">RESUMEN</p><h2>Tu pedido</h2></div><b>{lines.length}</b></div>
        <div className="cart-summary-row"><span>Objetos</span><strong>{lines.length}</strong></div>
        <div className="cart-summary-total"><span>Total estimado</span><strong>{formatMxn(total)} <small>MXN</small></strong></div>
        <p className="cart-summary-note"><ShieldCheck aria-hidden="true" size={17} />{commerce.validation?.status === "manual_review" ? "Tu ID ya fue enviado. La espera de 48 horas se registra una sola vez." : idSubmitted ? "Tu ID está listo; confirmaremos el precio antes de crear la orden." : "En el siguiente paso agregarás tu ID y confirmaremos el precio."}</p>
        {canContinue ? <Link className="primary-button" href="/checkout">Continuar compra <ArrowRight aria-hidden="true" size={17} /></Link> : <button className="primary-button" disabled>Hay objetos no disponibles</button>}
        <div className="cart-next-steps" aria-label="Siguientes pasos"><span><b><Check aria-hidden="true" size={12} /></b>Carrito</span><span className={idSubmitted ? "complete" : ""}><b>{idSubmitted ? <Check aria-hidden="true" size={12} /> : "2"}</b>{idSubmitted ? "ID enviado" : "Agregar ID"}</span><span><b>3</b>Contacto y orden</span></div>
        <Link className="cart-secondary" href="/#catalogo">Seguir comprando</Link>
      </aside>
      <SystemActionBar className="mobile-cart-checkout"><span><small>Total del carrito</small><strong>{formatMxn(total)}</strong></span>{canContinue ? <Link href="/checkout">Continuar compra <ArrowRight aria-hidden="true" size={16} /></Link> : <button disabled>No disponible</button>}</SystemActionBar>
    </div>}
  </section>;
}
