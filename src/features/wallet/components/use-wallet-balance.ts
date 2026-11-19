"use client";
import { useEffect, useSyncExternalStore } from "react";
import { walletRequest } from "./use-wallet";

export type WalletBalance = { balance: number; frozen: boolean; inReview: number };

/**
 * Saldo compartido por el encabezado, el menú de la cuenta y el carrito: una sola consulta ligera
 * (`/api/wallet?view=balance`) aunque varios componentes lo muestren. Se actualiza al volver a la
 * pestaña y cuando algo avisa que cambió (`notifyWalletChanged`), por ejemplo después de pagar.
 */
let current: WalletBalance | null = null;
let owner: string | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

async function load(sessionId: string | null) {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try { current = await walletRequest<WalletBalance>("/api/wallet?view=balance"); owner = sessionId; }
    catch { current = null; owner = null; }
    finally { inFlight = null; emit(); }
  })();
  return inFlight;
}

export const WALLET_CHANGED = "wallet:changed";
/** Llamar después de algo que mueve el saldo, para que el encabezado no quede atrasado. */
export function notifyWalletChanged() { if (typeof window !== "undefined") window.dispatchEvent(new Event(WALLET_CHANGED)); }

export function useWalletBalance(enabled: boolean, sessionId: string | null | undefined): WalletBalance | null {
  const session = sessionId ?? null;
  const value = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => current,
    () => null,
  );
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { if (!document.hidden) void load(session); };
    if (owner !== session || !current) void load(session);
    window.addEventListener("focus", refresh);
    window.addEventListener(WALLET_CHANGED, refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener(WALLET_CHANGED, refresh); };
  }, [enabled, session]);
  return enabled && owner === session ? value : null;
}
