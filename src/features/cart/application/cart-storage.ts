"use client";

import type { CatalogItem } from "@/features/catalog/domain/catalog-item";

export const CART_STORAGE_KEY = "sigfriedlootbox:cart";
export const CART_CHANGED_EVENT = "sigfriedlootbox:cart-changed";
export type CartItemSnapshot = Pick<CatalogItem, "mainId" | "offerId" | "name" | "imageUrl" | "type" | "rarity" | "finalPriceVbucks" | "priceMxn">;
export type CartEntry = Readonly<{ itemId: string; quantity: number; item?: CartItemSnapshot }>;

function snapshot(value: unknown): CartItemSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Partial<CartItemSnapshot>;
  if (typeof item.mainId !== "string" || typeof item.name !== "string" || typeof item.type !== "string" || typeof item.rarity !== "string" || typeof item.finalPriceVbucks !== "number" || (typeof item.priceMxn !== "number" && item.priceMxn !== null)) return undefined;
  return { mainId: item.mainId, offerId: typeof item.offerId === "string" ? item.offerId : null, name: item.name, imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null, type: item.type, rarity: item.rarity, finalPriceVbucks: item.finalPriceVbucks, priceMxn: item.priceMxn };
}

export function readCart(): CartEntry[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { itemId?: unknown; quantity?: unknown; item?: unknown };
      return typeof candidate.itemId === "string" && typeof candidate.quantity === "number" && Number.isInteger(candidate.quantity) && candidate.quantity > 0
        ? [{ itemId: candidate.itemId, quantity: Math.min(candidate.quantity, 10), item: snapshot(candidate.item) }] : [];
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

export function addToCart(item: CartItemSnapshot) {
  const cart = readCart(); const index = cart.findIndex((entry) => entry.itemId === item.mainId);
  if (index >= 0) cart[index] = { ...cart[index], item, quantity: Math.min(10, cart[index].quantity + 1) };
  else cart.push({ itemId: item.mainId, item, quantity: 1 });
  writeCart(cart);
}

export function resolveCartItem(entry: CartEntry, items: readonly CatalogItem[]): CatalogItem | CartItemSnapshot | null {
  return items.find((item) => item.mainId === entry.itemId)
    ?? (entry.item?.offerId ? items.find((item) => item.offerId === entry.item?.offerId) : undefined)
    ?? entry.item
    ?? null;
}
