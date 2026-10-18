"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

const LEGACY_CART_KEY = "sigfriedlootbox:cart";
const LEGACY_FAVORITES_KEY = "drop-shop-mx:favorites";
const SESSION_STALE_AFTER_MS = 5 * 60 * 1000;
const WAIT_COMPLETION_BUFFER_MS = 1000;

export type IdentityPlatform = "epic" | "xbl" | "psn" | "nintendo";
export type IdentityValidation = Readonly<{
  id: string;
  platform: IdentityPlatform;
  submitted_id: string;
  epic_account_id: string;
  display_name: string;
  status: "pending_friendship" | "waiting" | "ready" | "manual_review" | "blocked";
  giftable_at: string | null;
  last_checked_at: string;
}>;

type CommerceApiResponse = {
  error?: string;
  authenticated?: boolean;
  cartItemIds?: string[];
  favoriteItemIds?: string[];
  itemIds?: string[];
  validations?: IdentityValidation[];
  validation?: IdentityValidation;
  activeValidationId?: string | null;
  [key: string]: unknown;
};

type CommerceState = Readonly<{
  ready: boolean;
  authenticated: boolean;
  syncing: boolean;
  cartItemIds: readonly string[];
  favoriteItemIds: ReadonlySet<string>;
  validations: readonly IdentityValidation[];
  validation: IdentityValidation | null;
  identityOpen: boolean;
  refresh: () => Promise<void>;
  openIdentity: () => void;
  closeIdentity: () => void;
  validateIdentity: (displayName: string, platform: IdentityPlatform) => Promise<string | null>;
  selectValidation: (validationId: string) => Promise<string | null>;
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

async function responseBody(response: Response): Promise<CommerceApiResponse> {
  const body = await response.json().catch(() => null);
  return body && typeof body === "object"
    ? body as CommerceApiResponse
    : { error: "El servicio respondió sin detalles. Intenta de nuevo." };
}

export function CommerceStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cartItemIds, setCartItemIds] = useState<string[]>([]);
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<string>>(new Set());
  const [validations, setValidations] = useState<IdentityValidation[]>([]);
  const [activeValidationId, setActiveValidationId] = useState<string | null>(null);
  const validation = useMemo(() => validations.find((entry) => entry.id === activeValidationId) ?? null, [activeValidationId, validations]);
  const [identityOpen, setIdentityOpen] = useState(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAttemptAtRef = useRef(0);
  const hasHydratedRef = useRef(false);
  const openIdentity = useCallback(() => setIdentityOpen(true), []);
  const closeIdentity = useCallback(() => setIdentityOpen(false), []);
  const clearCart = useCallback(() => setCartItemIds([]), []);

  const refresh = useCallback((): Promise<void> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const request = (async () => {
      const cart = legacyCartIds();
      const favorites = legacyFavoriteIds();
      lastRefreshAttemptAtRef.current = Date.now();
      try {
        const response = await fetch("/api/commerce/session", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ cartItemIds: cart, favoriteItemIds: favorites })
        });
        const body = await responseBody(response);
        if (!response.ok) throw new Error(body.error);
        setCartItemIds(body.cartItemIds ?? []);
        setFavoriteItemIds(new Set(body.favoriteItemIds ?? []));
        setValidations(body.validations ?? (body.validation ? [body.validation] : []));
        setActiveValidationId(body.activeValidationId ?? body.validation?.id ?? null);
        setAuthenticated(body.authenticated === true);
        window.localStorage.removeItem(LEGACY_CART_KEY);
        window.localStorage.removeItem(LEGACY_FAVORITES_KEY);
      } catch {
        // Local storage is only a bootstrap fallback. A later network failure
        // must not erase state that was already confirmed by the server.
        if (!hasHydratedRef.current) {
          setCartItemIds(cart);
          setFavoriteItemIds(new Set(favorites));
        }
      } finally {
        hasHydratedRef.current = true;
        setReady(true);
      }
    })();

    refreshInFlightRef.current = request;
    void request.finally(() => {
      if (refreshInFlightRef.current === request) refreshInFlightRef.current = null;
    });
    return request;
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAttemptAtRef.current < SESSION_STALE_AFTER_MS) return;
      void refresh();
    };
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.clearTimeout(initialRefresh);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [refresh]);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      window.setTimeout(() => void refresh(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (validation?.status !== "waiting" || !validation.giftable_at) return;
    const giftableAt = new Date(validation.giftable_at).getTime();
    if (!Number.isFinite(giftableAt)) return;
    const timeout = window.setTimeout(
      () => void refresh(),
      Math.max(WAIT_COMPLETION_BUFFER_MS, giftableAt - Date.now() + WAIT_COMPLETION_BUFFER_MS),
    );
    return () => window.clearTimeout(timeout);
  }, [refresh, validation?.giftable_at, validation?.status]);

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
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.error ?? "No fue posible guardar el carrito.");
      if (!body.itemIds) throw new Error("El servicio no devolvió el carrito actualizado.");
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
      const body = await responseBody(response);
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
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.error);
      const savedValidation = body.validation;
      if (!savedValidation) throw new Error("El servicio no devolvió el ID guardado.");
      setValidations((current) => [savedValidation, ...current.filter((entry) => entry.id !== savedValidation.id)]);
      setActiveValidationId(savedValidation.id);
      return null;
    } catch (error) { return error instanceof Error ? error.message : "No fue posible validar el ID."; }
    finally { setSyncing(false); }
  }, []);

  const selectValidation = useCallback(async (validationId: string) => {
    if (validationId === activeValidationId) return null;
    setSyncing(true);
    try {
      const response = await fetch("/api/identity/active", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ validationId })
      });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.error);
      if (!body.activeValidationId) throw new Error("El servicio no devolvió el ID activo.");
      setActiveValidationId(body.activeValidationId);
      return null;
    } catch (error) { return error instanceof Error ? error.message : "No fue posible cambiar el ID."; }
    finally { setSyncing(false); }
  }, [activeValidationId]);

  const requestFriendship = useCallback(async () => {
    if (!validation) return "Primero valida tu ID.";
    setSyncing(true);
    try {
      const response = await fetch("/api/identity/friend-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ validationId: validation.id })
      });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.error);
      setValidations((current) => current.map((entry) => entry.id === validation.id ? { ...entry, status: "pending_friendship" } : entry));
      return null;
    } catch (error) { return error instanceof Error ? error.message : "No fue posible enviar la solicitud."; }
    finally { setSyncing(false); }
  }, [validation]);

  const value = useMemo<CommerceState>(() => ({
    ready, authenticated, syncing, cartItemIds, favoriteItemIds, validations, validation, identityOpen, refresh,
    openIdentity,
    closeIdentity,
    validateIdentity, selectValidation, requestFriendship, addCartItem, removeCartItem, toggleFavorite,
    clearCart
  }), [ready, authenticated, syncing, cartItemIds, favoriteItemIds, validations, validation, identityOpen, refresh, openIdentity, closeIdentity, validateIdentity, selectValidation, requestFriendship, addCartItem, removeCartItem, toggleFavorite, clearCart]);

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
