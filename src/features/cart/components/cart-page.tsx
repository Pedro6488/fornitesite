"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";

export function CartPage({ items }: { items: readonly CatalogItem[] }) {
  const commerce = useCommerceState();
  const [message, setMessage] = useState<string | null>(null);
  const lines = useMemo(() => commerce.cartItemIds.flatMap((id) => { const item = items.find((candidate) => candidate.mainId === id); return item ? [{ item }] : []; }), [commerce.cartItemIds, items]);
  const total = lines.reduce((sum, line) => sum + (line.item.priceMxn ?? 0), 0);
  const canContinue = lines.length > 0 && lines.every(({ item }) => item.priceMxn !== null && item.offerId && item.giftable);
  async function remove(itemId: string) { setMessage(await commerce.removeCartItem(itemId)); }

  return <section className="cart-page">
    <header><p className="eyebrow">TU CARRITO</p><h1>Revisa tu selección</h1><p>Una unidad por objeto. El precio se confirmará de forma segura antes de crear el pedido.</p></header>
    {!commerce.ready ? <div className="cart-empty"><h2>Cargando tu carrito…</h2></div> : lines.length === 0 ? <div className="cart-empty"><h2>Tu carrito está vacío</h2><p>Explora los objetos disponibles y agrega los que quieras solicitar.</p><Link href="/#catalogo">Ver tienda</Link></div> : <div className="cart-layout">
      <div className="cart-lines">
        {lines.map(({ item }) => <article className="cart-line" key={item.mainId}>
          <div className="cart-item-image">{item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="(max-width: 600px) 56px, 68px" /> : <span aria-hidden="true">{item.name.slice(0, 1)}</span>}</div>
          <div className="cart-item-copy"><h2>{item.name}</h2><p>{item.type} · {item.priceMxn === null ? "Precio por confirmar" : `${formatMxn(item.priceMxn)} c/u`}</p></div>
          <div className="cart-line-actions"><span className="cart-one-only">1 por pedido</span><button className="cart-remove" onClick={() => void remove(item.mainId)} aria-label={`Quitar ${item.name} del carrito`}>Quitar</button><strong>{item.priceMxn === null ? "Consultar" : formatMxn(item.priceMxn)}</strong></div>
        </article>)}
        {message && <p className="notice error">{message}</p>}
      </div>
      <aside className="cart-summary"><p className="eyebrow">RESUMEN</p><div><span>Objetos</span><strong>{lines.length}</strong></div><div><span>Total estimado</span><strong>{formatMxn(total)}</strong></div>{canContinue ? <Link className="primary-button" href="/checkout">Continuar compra</Link> : <button className="primary-button" disabled>Hay objetos no disponibles</button>}<Link className="cart-secondary" href="/#catalogo">Seguir comprando</Link></aside>
      <div className="mobile-cart-checkout"><span><small>Total estimado</small><strong>{formatMxn(total)}</strong></span>{canContinue ? <Link href="/checkout">Continuar compra</Link> : <button disabled>No disponible</button>}</div>
    </div>}
  </section>;
}
