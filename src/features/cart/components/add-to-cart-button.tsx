"use client";

import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { addToCart } from "../application/cart-storage";
import type { CartItemSnapshot } from "../application/cart-storage";
import { useOptionalCommerceState } from "@/features/commerce/components/commerce-state-provider";

export function AddToCartButton({ item, compact = false, redirectTo, disabled = false }: { item: CartItemSnapshot; compact?: boolean; redirectTo?: string; disabled?: boolean }) {
  const commerce = useOptionalCommerceState();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(false);

  async function add() {
    if (disabled) return;
    const failure = commerce ? await commerce.addCartItem(item.mainId) : (addToCart(item), null);
    if (failure) { setError(true); window.setTimeout(() => setError(false), 2000); return; }
    if (redirectTo) {
      window.location.assign(redirectTo);
      return;
    }
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  const label = disabled ? "No disponible" : error ? "Intenta de nuevo" : added ? "Agregado" : "Agregar al carrito";

  return <button type="button" aria-label={`${label}: ${item.name}`} disabled={disabled || commerce?.syncing} className={compact ? "cart-add cart-add-compact" : "primary-button"} onClick={() => void add()}>
    {compact && (added ? <Check aria-hidden="true" size={15} /> : <ShoppingBag aria-hidden="true" size={15} />)}
    {label}
  </button>;
}
