"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addToCart } from "../application/cart-storage";
import type { CartItemSnapshot } from "../application/cart-storage";

export function AddToCartButton({ item, compact = false, redirectTo }: { item: CartItemSnapshot; compact?: boolean; redirectTo?: string }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);

  function add() {
    addToCart(item);
    if (redirectTo) {
      router.push(redirectTo);
      return;
    }
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return <button type="button" className={compact ? "cart-add cart-add-compact" : "primary-button"} onClick={add}>
    {added ? "Agregado al carrito" : "Agregar al carrito"}
  </button>;
}
