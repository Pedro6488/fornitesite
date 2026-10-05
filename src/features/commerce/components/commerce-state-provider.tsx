"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

const LEGACY_CART_KEY = "sigfriedlootbox:cart";
const LEGACY_FAVORITES_KEY = "drop-shop-mx:favorites";

export type IdentityPlatform = "epic" | "xbl" | "psn" | "nintendo";
export type IdentityValidation = Readonly<{
  id: string;
  platform: IdentityPlatform;
  submitted_id: string;
  epic_account_id: string;
  display_name: string;
  status: "pending_friendship" | "waiting" | "ready" | "blocked";
  giftable_at: string | null;
  last_checked_at: string;
}>;

type CommerceState = Readonly<{
  ready: boolean;
  syncing: boolean;
  cartItemIds: readonly string[];
  favoriteItemIds: ReadonlySet<string>;
  validation: IdentityValidation | null;
  identityOpen: boolean;
  openIdentity: () => void;
  closeIdentity: () => void;
  validateIdentity: (displayName: string, platform: IdentityPlatform) => Promise<string | null>;
  requestFriendship: () => Promise<string | null>;
  addCartItem: (itemId: string) => Promise<string | null>;
  removeCartItem: (itemId: string) => Promise<string | null>;
  toggleFavorite: (itemId: string) => Promise<string | null>;
  clearCart: () => void;
}>;

const CommerceContext = createContext<CommerceState | null>(null);

function legacyCartIds(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(LEGACY_CART_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return [...new Set(value.flatMap((entry) => entry && typeof entry === "object" && typeof (entry as { itemId?: unknown }).itemId === "string" ? [(entry as { itemId: string }).itemId] : []))];
  } catch { return []; }
}

function legacyFavoriteIds(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(LEGACY_FAVORITES_KEY) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string"))] : [];
  } catch { return []; }
}

async function authHeaders(): Promise<HeadersInit> {
  const supabase = getSupabaseBrowser();
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function CommerceStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cartItemIds, setCartItemIds] = useState<string[]>([]);
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<string>>(new Set());
  const [validation, setValidation] = useState<IdentityValidation | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const openIdentity = useCallback(() => setIdentityOpen(true), []);
  const closeIdentity = useCallback(() => setIdentityOpen(false), []);
  const clearCart = useCallback(() => setCartItemIds([]), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const cart = legacyCartIds();
      const favorites = legacyFavoriteIds();
      try {
        const response = await fetch("/api/commerce/session", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ cartItemIds: cart, favoriteItemIds: favorites })
        });
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setCartItemIds(body.cartItemIds ?? []);
        setFavoriteItemIds(new Set(body.favoriteItemIds ?? []));
        setValidation(body.validation ?? null);
        window.localStorage.removeItem(LEGACY_CART_KEY);
        window.localStorage.removeItem(LEGACY_FAVORITES_KEY);
      } catch {
        if (!active) return;
        setCartItemIds(cart);
        setFavoriteItemIds(new Set(favorites));
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

  const persistCart = useCallback(async (next: string[]) => {
    const previous = cartItemIds;
    setCartItemIds(next);
    setSyncing(true);
    try {
      const response = await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ itemIds: next })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No fue posible guardar el carrito.");
      setCartItemIds(body.itemIds);
      return null;
    } catch (error) {
      setCartItemIds(previous);
      return error instanceof Error ? error.message : "No fue posible guardar el carrito.";
    } finally { setSyncing(false); }
  }, [cartItemIds]);

  const addCartItem = useCallback(async (itemId: string) => {
    if (cartItemIds.includes(itemId)) return null;
    return persistCart([...cartItemIds, itemId]);
  }, [cartItemIds, persistCart]);
  const removeCartItem = useCallback(async (itemId: string) => persistCart(cartItemIds.filter((id) => id !== itemId)), [cartItemIds, persistCart]);

  const toggleFavorite = useCallback(async (itemId: string) => {
    const active = favoriteItemIds.has(itemId);
    const next = new Set(favoriteItemIds);
    if (active) next.delete(itemId);
    else next.add(itemId);
    setFavoriteItemIds(next);
    try {
      const response = await fetch("/api/favorites", {
        method: active ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ itemMainId: itemId })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      return null;
    } catch (error) {
      setFavoriteItemIds(favoriteItemIds);
      return error instanceof Error ? error.message : "No fue posible actualizar favoritos.";
    }
  }, [favoriteItemIds]);

  const validateIdentity = useCallback(async (displayName: string, platform: IdentityPlatform) => {
    setSyncing(true);
    try {
      const response = await fetch("/api/identity/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ displayName, platform })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setValidation(body.validation);
      return null;
    } catch (error) { return error instanceof Error ? error.message : "No fue posible validar el ID."; }
    finally { setSyncing(false); }
  }, []);

  const requestFriendship = useCallback(async () => {
    if (!validation) return "Primero valida tu ID.";
    setSyncing(true);
    try {
      const response = await fetch("/api/identity/friend-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ validationId: validation.id })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setValidation({ ...validation, status: "pending_friendship" });
      return null;
    } catch (error) { return error instanceof Error ? error.message : "No fue posible enviar la solicitud."; }
    finally { setSyncing(false); }
  }, [validation]);

  const value = useMemo<CommerceState>(() => ({
    ready, syncing, cartItemIds, favoriteItemIds, validation, identityOpen,
    openIdentity,
    closeIdentity,
    validateIdentity, requestFriendship, addCartItem, removeCartItem, toggleFavorite,
    clearCart
  }), [ready, syncing, cartItemIds, favoriteItemIds, validation, identityOpen, openIdentity, closeIdentity, validateIdentity, requestFriendship, addCartItem, removeCartItem, toggleFavorite, clearCart]);

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerceState(): CommerceState {
  const value = useContext(CommerceContext);
  if (!value) throw new Error("useCommerceState debe usarse dentro de CommerceStateProvider.");
  return value;
}

export function useOptionalCommerceState(): CommerceState | null {
  return useContext(CommerceContext);
}
