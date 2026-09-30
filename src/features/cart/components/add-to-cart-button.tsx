"use client";

import { useState } from "react";
import { addToCart } from "../application/cart-storage";
import type { CartItemSnapshot } from "../application/cart-storage";

export function AddToCartButton({ item, compact = false }: { item: CartItemSnapshot; compact?: boolean }) {
  const [added, setAdded] = useState(false);
  return <button type="button" className={compact ? "cart-add cart-add-compact" : "primary-button"} onClick={() => { addToCart(item); setAdded(true); window.setTimeout(() => setAdded(false), 1600); }}>
    {added ? "Agregado al carrito" : "Agregar al carrito"}
  </button>;
}
