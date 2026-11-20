"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import type { WalletData } from "../domain/wallet";
import type { PAYMENT_DETAILS } from "@/features/orders/config/payment-details";
export async function walletRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = (await getSupabaseBrowser()?.auth.getSession())?.data.session?.access_token;
  if (!token) throw new Error("Inicia sesión para usar tus pavos.");
  const response = await fetch(url, { ...init, cache: "no-store", headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "No fue posible completar la operación.");
  return body;
}
export function useWallet(enabled: boolean, sessionId?: string | null) {
  const [data, setData] = useState<(WalletData & { paymentDetails: typeof PAYMENT_DETAILS }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null | undefined>(undefined);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!enabled) { setData(null); return; }
    try {
      const next = await walletRequest<NonNullable<typeof data>>("/api/wallet");
      if (current === generation.current) { setData(next); setOwner(sessionId); setError(null); }
    } catch (cause) { if (current === generation.current) { setData(null); setError(cause instanceof Error ? cause.message : "No fue posible consultar el saldo."); } }
  }, [enabled, sessionId]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void reload());
    const activeGeneration = generation;
    const timer = window.setInterval(() => { if (!document.hidden) void reload(); }, 30000);
    return () => { activeGeneration.current++; window.cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, [reload]);
  return { data: enabled && owner === sessionId ? data : null, error, reload };
}
