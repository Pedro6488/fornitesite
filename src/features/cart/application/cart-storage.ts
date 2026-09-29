"use client";

export const CART_STORAGE_KEY = "sigfriedlootbox:cart";
export const CART_CHANGED_EVENT = "sigfriedlootbox:cart-changed";
export type CartEntry = Readonly<{ itemId: string; quantity: number }>;

export function readCart(): CartEntry[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { itemId?: unknown; quantity?: unknown };
      return typeof candidate.itemId === "string" && typeof candidate.quantity === "number" && Number.isInteger(candidate.quantity) && candidate.quantity > 0
        ? [{ itemId: candidate.itemId, quantity: Math.min(candidate.quantity, 10) }] : [];
    });
  } catch { return []; }
}

export function writeCart(entries: readonly CartEntry[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

export function subscribeToCart(listener: () => void) {
  window.addEventListener("storage", listener); window.addEventListener(CART_CHANGED_EVENT, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(CART_CHANGED_EVENT, listener); };
}

export function addToCart(itemId: string) {
  const cart = readCart(); const index = cart.findIndex((entry) => entry.itemId === itemId);
  if (index >= 0) cart[index] = { ...cart[index], quantity: Math.min(10, cart[index].quantity + 1) };
  else cart.push({ itemId, quantity: 1 });
  writeCart(cart);
}
