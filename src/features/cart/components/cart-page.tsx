"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { readCart, subscribeToCart, writeCart, type CartEntry } from "../application/cart-storage";

export function CartPage({ items }: { items: readonly CatalogItem[] }) {
  const [cart, setCart] = useState<CartEntry[]>([]);
  useEffect(() => { const update = () => setCart(readCart()); update(); return subscribeToCart(update); }, []);
  const lines = useMemo(() => cart.flatMap((entry) => { const item = items.find((candidate) => candidate.mainId === entry.itemId); return item?.priceMxn !== null && item?.priceMxn !== undefined ? [{ item, quantity: entry.quantity }] : []; }), [cart, items]);
  const total = lines.reduce((sum, line) => sum + line.item.priceMxn! * line.quantity, 0);
  function change(itemId: string, quantity: number) { const next = cart.flatMap((entry) => entry.itemId !== itemId ? [entry] : quantity > 0 ? [{ ...entry, quantity: Math.min(10, quantity) }] : []); writeCart(next); }
  return <section className="cart-page"><header><p className="eyebrow">TU CARRITO</p><h1>Revisa tu selección</h1><p>Confirma cantidades y continúa cuando estés listo.</p></header>{lines.length === 0 ? <div className="cart-empty"><h2>Tu carrito está vacío</h2><p>Explora los objetos disponibles y agrega los que quieras solicitar.</p><Link href="/#catalogo">Ver tienda</Link></div> : <div className="cart-layout"><div className="cart-lines">{lines.map(({ item, quantity }) => <article className="cart-line" key={item.mainId}><div><h2>{item.name}</h2><p>{item.type} · {formatMxn(item.priceMxn!)} c/u</p></div><div className="quantity-control"><button onClick={() => change(item.mainId, quantity - 1)} aria-label={`Quitar uno de ${item.name}`}>−</button><strong>{quantity}</strong><button onClick={() => change(item.mainId, quantity + 1)} aria-label={`Agregar uno de ${item.name}`}>+</button></div><strong>{formatMxn(item.priceMxn! * quantity)}</strong></article>)}</div><aside className="cart-summary"><p className="eyebrow">RESUMEN</p><div><span>Objetos</span><strong>{lines.reduce((sum, line) => sum + line.quantity, 0)}</strong></div><div><span>Total</span><strong>{formatMxn(total)}</strong></div><Link className="primary-button" href="/checkout">Continuar compra</Link><Link className="cart-secondary" href="/#catalogo">Seguir comprando</Link></aside></div>}</section>;
}
