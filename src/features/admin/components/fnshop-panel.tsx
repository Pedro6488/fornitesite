"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, KeyRound, RefreshCw } from "lucide-react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import { formatDateTime, formatDayKey } from "../application/format";
import { AdminPageHeader } from "./admin-shell";
import { BarList, ChartCard, ColumnChart, StatTile } from "./charts";
import { useAdminData, useAdminRequest } from "./use-admin-request";

type Level = "ok" | "warning" | "reserve" | "critical" | "exhausted";
type Call = {
  id: number; created_at: string; action: string; code: string | null; result: boolean | null; decision: string | null;
  duration_ms: number | null; trigger: string; order_id: string | null; validation_id: string | null; simulated: boolean; counted: boolean;
  error: string | null; http_status: number | null;
};
type FnShopData = {
  mode: "manual" | "automatic"; available: boolean; simulated: boolean; live: boolean; category: string | null;
  term: { startsAt: string; monthlyLimit: number; dailyLimit: number };
  usage: { used: number; today: number; remaining: number; level: Level; pacePerDay: number; exhaustsInDays: number | null; lastCallAt: string | null };
  byAction: { action: string; calls: number; counted: number }[];
  byDay: { day: string; counted: number; calls: number }[];
  recent: Call[];
  contract: { action: string; code: string; result: boolean | null; simulated: boolean; calls: number; last_seen: string; response_fields: string[] | null }[];
};

const ACTION_LABELS: Record<string, string> = {
  friend_add: "Validar ID y enviar solicitud", friend_status: "«Ya acepté»", gift_check: "Pre-vuelo", gift_send: "Enviar regalo",
  order_history: "Conciliar", shop: "Buscar offerId", verify_license: "Verificar key", groups_status: "Estado de cuentas",
};

const LEVEL_TEXT: Record<Level, string> = {
  ok: "Todo normal.",
  warning: "Más del 70 % usado. Solo es un aviso.",
  reserve: "Más del 85 %: los IDs nuevos pasan a revisión manual para guardar requests para entregar.",
  critical: "Más del 95 %: solo se permite entregar y conciliar.",
  exhausted: "Se acabaron los requests del periodo.",
};

const numberFormat = (value: number) => value.toLocaleString("es-MX");

/** Sección FN Shop: cuota, consumo y bitácora. Abrirla cuesta 0 requests. */
export function FnShopPanel() {
  const request = useAdminRequest();
  const { data, error, loading, reload } = useAdminData<FnShopData>("/api/admin/fnshop", { refreshMs: 60_000 });
  const [verify, setVerify] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState<"verify" | null>(null);

  async function verifyKey() {
    setBusy("verify"); setVerify(null);
    try {
      const body = await request<{ ok: boolean; simulated: boolean; plan: string | null; code: string | null }>("/api/admin/fnshop", { method: "POST" });
      setVerify({ error: !body.ok, text: body.ok ? `La key responde${body.plan ? ` (plan ${body.plan})` : ""}${body.simulated ? " · simulado" : ""}. No gastó cuota.` : `FN Shop rechazó la key (${body.code ?? "sin code"}).` });
      void reload();
    } catch (cause) {
      setVerify({ error: true, text: cause instanceof Error ? cause.message : "No fue posible verificar la key." });
    } finally { setBusy(null); }
  }

  const header = <AdminPageHeader title="FN Shop" lead="Cuántos requests llevamos, en qué se gastan y qué respondió FN Shop en cada llamada."
    actions={<>
      <button type="button" className="ac-ghost" disabled={busy !== null} onClick={() => void verifyKey()}><KeyRound aria-hidden="true" size={15} />{busy === "verify" ? "Verificando…" : "Verificar key"}</button>
      <button type="button" className="ac-ghost" disabled={loading} onClick={() => void reload()}><RefreshCw aria-hidden="true" size={15} />{loading ? "Actualizando…" : "Actualizar"}</button>
    </>} />;

  if (!data) return <>{header}{error ? <p className="ac-notice is-error" role="alert">{error}</p> : <p className="ac-notice">Cargando…</p>}</>;

  const { usage, term } = data;
  const ratio = term.monthlyLimit > 0 ? Math.min(1, usage.used / term.monthlyLimit) : 0;
  const tone = usage.level === "ok" ? "" : usage.level === "warning" ? " is-warn" : " is-bad";

  return <>
    {header}
    {verify && <p className={`ac-notice${verify.error ? " is-error" : " is-success"}`} role="status">{verify.text}</p>}
    {error && <p className="ac-notice is-error" role="alert">{error}</p>}
    {data.mode === "manual" && <p className="ac-notice">La entrega está en modo manual (<code>FULFILLMENT_MODE=manual</code>): la tienda no llama a FN Shop. Esta pantalla muestra la bitácora que haya.</p>}
    {data.mode === "automatic" && data.simulated && <p className="ac-notice">Modo simulado (<code>FNSHOP_SIMULATE=true</code>): las respuestas vienen del simulador, no salen a FN Shop y no gastan cuota.</p>}
    {data.mode === "automatic" && !data.available && <p className="ac-notice is-error">La entrega automática está encendida pero FN Shop no está disponible aquí: falta la key en producción o el simulador fuera de producción. Los IDs nuevos quedan en revisión manual.</p>}

    <section className="ac-card" aria-labelledby="ac-quota-title">
      <header className="ac-card-head"><div><h2 id="ac-quota-title">Cuota del periodo</h2><p>Desde el {formatDateTime(term.startsAt)}. {LEVEL_TEXT[usage.level]}</p></div></header>
      <div className={`ac-meter${tone}`} role="meter" aria-valuemin={0} aria-valuemax={term.monthlyLimit} aria-valuenow={usage.used} aria-label="Requests usados del periodo"><span style={{ width: `${Math.max(ratio * 100, usage.used > 0 ? 1 : 0)}%` }} /></div>
      <div className="ac-stats" style={{ marginTop: "1rem" }}>
        <StatTile label="Usados" value={`${numberFormat(usage.used)} de ${numberFormat(term.monthlyLimit)}`} hint={`${Math.round(ratio * 1000) / 10} % del plan`} />
        <StatTile label="Quedan" value={numberFormat(usage.remaining)} hint={usage.exhaustsInDays === null ? "Sin consumo todavía." : `A este ritmo alcanzan para ${numberFormat(usage.exhaustsInDays)} días.`} />
        <StatTile label="Hoy" value={`${numberFormat(usage.today)} de ${numberFormat(term.dailyLimit)}`} hint="Tope diario; al llegar solo se entrega y concilia." />
        <StatTile label="Ritmo" value={`${usage.pacePerDay} por día`} hint={usage.lastCallAt ? `Última llamada: ${formatDateTime(usage.lastCallAt)}` : "Sin llamadas."} />
      </div>
      <p className="ac-footnote">Para cuadrar, compara con «Requests used» de la miniapp de FN Shop. Las llamadas simuladas y «Verificar key» no cuentan.</p>
    </section>

    <div className="ac-grid-2">
      <ChartCard title="Requests por día" question="¿Cuántos requests contaron cada día del periodo?"
        table={{ columns: ["Día", "Contaron", "Llamadas"], rows: data.byDay.map((entry) => [formatDayKey(entry.day, { day: "numeric", month: "short" }), entry.counted, entry.calls]) }}>
        <ColumnChart ariaLabel="Requests que contaron por día" wholeNumbers formatValue={(value) => `${value} ${value === 1 ? "request" : "requests"}`} formatTick={(value) => String(value)}
          points={data.byDay.map((entry) => ({ key: entry.day, label: formatDayKey(entry.day, { weekday: "long", day: "numeric", month: "long" }), shortLabel: formatDayKey(entry.day), value: entry.counted, detail: entry.calls !== entry.counted ? `${entry.calls} llamadas en total` : undefined }))} />
      </ChartCard>
      <ChartCard title="En qué se gastan" question="Requests que contaron, por tipo de llamada."
        table={{ columns: ["Llamada", "Contaron", "Llamadas"], rows: data.byAction.map((entry) => [ACTION_LABELS[entry.action] ?? entry.action, entry.counted, entry.calls]) }}>
        <BarList emptyText="Todavía no hay llamadas en este periodo." rows={data.byAction.map((entry) => ({ key: entry.action, label: ACTION_LABELS[entry.action] ?? entry.action, value: entry.counted, valueLabel: numberFormat(entry.counted), note: entry.calls !== entry.counted ? `${entry.calls} llamadas en total` : entry.action }))} />
      </ChartCard>
    </div>

    <section className="ac-card" aria-labelledby="ac-log-title">
      <header className="ac-card-head">
        <div><h2 id="ac-log-title">Bitácora</h2><p>Las últimas 100 llamadas. Cada una guarda lo que se pidió y lo que respondió FN Shop, sin la API key.</p></div>
        <div className="ac-card-tools">
          <ExportLink format="json" />
          <ExportLink format="csv" />
        </div>
      </header>
      {data.recent.length === 0 ? <p className="ac-empty">Todavía no hay llamadas registradas.</p> : <div className="ac-table-wrap ac-log-wrap"><table className="ac-table ac-log">
        <thead><tr><th scope="col">Cuándo</th><th scope="col">Llamada</th><th scope="col">Respuesta</th><th scope="col">Decisión</th><th scope="col" className="num">ms</th><th scope="col">Origen</th><th scope="col">Pedido / ID</th></tr></thead>
        <tbody>{data.recent.map((call) => <tr key={call.id}>
          <th scope="row">{formatDateTime(call.created_at)}</th>
          <td>{ACTION_LABELS[call.action] ?? call.action}{call.simulated ? " · simulada" : !call.counted ? " · no contó" : ""}</td>
          <td className="ac-wrap">{call.code ?? (call.error ? `Error: ${call.error}` : "—")}</td>
          <td>{call.decision ?? "—"}</td>
          <td className="num">{call.duration_ms ?? "—"}</td>
          <td>{call.trigger === "customer" ? "Cliente" : call.trigger === "admin" ? "Admin" : "Sistema"}</td>
          <td>{call.order_id ? <Link className="ac-link" href={`/admin/pedidos/${call.order_id}`}>Pedido {call.order_id.slice(0, 8).toUpperCase()}</Link> : call.validation_id ? `ID ${call.validation_id.slice(0, 8)}` : "—"}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>

    <section className="ac-card" aria-labelledby="ac-contract-title">
      <header className="ac-card-head"><div><h2 id="ac-contract-title">Respuestas vistas</h2><p>Cada combinación de llamada y code que ha respondido FN Shop, con los campos que trae. Es el contrato que tendrá que imitar la entrega propia.</p></div></header>
      {data.contract.length === 0 ? <p className="ac-empty">Sin respuestas todavía.</p> : <div className="ac-table-wrap"><table className="ac-table ac-log">
        <thead><tr><th scope="col">Llamada</th><th scope="col">Code</th><th scope="col" className="num">Veces</th><th scope="col">Última vez</th><th scope="col">Campos</th></tr></thead>
        <tbody>{data.contract.map((entry) => <tr key={`${entry.action}-${entry.code}-${entry.simulated}-${String(entry.result)}`}>
          <th scope="row">{entry.action}{entry.simulated ? " · simulada" : ""}</th>
          <td>{entry.code}</td>
          <td className="num">{entry.calls}</td>
          <td>{formatDateTime(entry.last_seen)}</td>
          <td className="ac-wrap">{(entry.response_fields ?? []).join(", ") || "—"}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}

/** Descarga la bitácora con la sesión del administrador. */
function ExportLink({ format }: { format: "json" | "csv" }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function run() {
    setBusy(true); setFailed(false);
    try {
      // La descarga necesita la sesión del administrador, por eso no es un enlace directo.
      const token = (await getSupabaseBrowser()?.auth.getSession())?.data.session?.access_token;
      const response = await fetch(`/api/admin/fnshop/export?format=${format}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `fnshop-bitacora-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <button type="button" className="ac-ghost" disabled={busy} onClick={() => void run()} title={failed ? "No se pudo descargar. Intenta de nuevo." : undefined}>
    <Download aria-hidden="true" size={15} />{busy ? "Descargando…" : failed ? `Reintentar ${format.toUpperCase()}` : `Exportar ${format.toUpperCase()}`}
  </button>;
}
