"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

export type AdminRequest = <T = Record<string, unknown>>(url: string, init?: RequestInit) => Promise<T>;

/** Llama a una ruta `/api/admin/*` con la sesión del administrador. */
export function useAdminRequest(): AdminRequest {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  return useCallback(async <T,>(url: string, init?: RequestInit) => {
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session) throw new Error("La sesión de administrador expiró. Vuelve a iniciar sesión.");
    const response = await fetch(url, { cache: "no-store", ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "No fue posible completar la operación.");
    return body as T;
  }, [supabase]);
}

/**
 * Carga datos de una ruta de la consola y los mantiene al día.
 * Al recargar conserva lo que ya se veía (`loading` avisa) para que la pantalla no salte.
 * Con `refreshMs`, vuelve a cargar cada cierto tiempo solo mientras la pestaña está visible.
 */
export function useAdminData<T>(url: string | null, options: { refreshMs?: number } = {}) {
  const request = useAdminRequest();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!url) return;
    const requestId = ++latest.current;
    setLoading(true);
    try {
      const body = await request<T>(url);
      if (requestId !== latest.current) return;
      setData(body);
      setError(null);
    } catch (cause) {
      if (requestId === latest.current) setError(cause instanceof Error ? cause.message : "No fue posible cargar la información.");
    } finally {
      if (requestId === latest.current) setLoading(false);
    }
  }, [request, url]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void reload());
    return () => window.cancelAnimationFrame(frame);
  }, [reload]);

  const { refreshMs } = options;
  useEffect(() => {
    if (!refreshMs) return;
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void reload(); }, refreshMs);
    const onVisible = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [refreshMs, reload]);

  return { data, error, loading, reload };
}
