"use client";

import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { addToCart } from "../application/cart-storage";
import type { CartItemSnapshot } from "../application/cart-storage";
import { useOptionalCommerceState } from "@/features/commerce/components/commerce-state-provider";

export function AddToCartButton({ item, compact = false, redirectTo, disabled = false }: { item: CartItemSnapshot; compact?: boolean; redirectTo?: string; disabled?: boolean }) {
  const commerce = useOptionalCommerceState();
  const [localAdded, setLocalAdded] = useState(false);
  const [error, setError] = useState(false);
  const added = commerce ? commerce.cartItemIds.includes(item.mainId) : localAdded;

  async function add() {
    if (disabled || added) return;
    const failure = commerce ? await commerce.addCartItem(item.mainId) : (addToCart(item), null);
    if (failure) { setError(true); window.setTimeout(() => setError(false), 2000); return; }
    if (redirectTo) {
      window.location.assign(redirectTo);
      return;
    }
    setLocalAdded(true);
  }

  const label = disabled ? "No disponible" : error ? "Intenta de nuevo" : added ? "Agregado" : "Agregar al carrito";

  return <button type="button" aria-label={`${label}: ${item.name}`} aria-pressed={added} disabled={disabled || commerce?.syncing} className={`${compact ? "cart-add cart-add-compact" : "primary-button"} ${added ? "is-added" : ""}`} onClick={() => void add()}>
    {compact && (added ? <Check aria-hidden="true" size={15} /> : <ShoppingBag aria-hidden="true" size={15} />)}
    {label}
  </button>;
}
