"use client";

import { useState } from "react";
import { addToCart } from "../application/cart-storage";

export function AddToCartButton({ itemId, compact = false }: { itemId: string; compact?: boolean }) {
  const [added, setAdded] = useState(false);
  return <button type="button" className={compact ? "cart-add cart-add-compact" : "primary-button"} onClick={() => { addToCart(itemId); setAdded(true); window.setTimeout(() => setAdded(false), 1600); }}>
    {added ? "Agregado al carrito" : "Agregar al carrito"}
  </button>;
}
