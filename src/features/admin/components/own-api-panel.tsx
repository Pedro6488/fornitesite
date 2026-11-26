"use client";

import Link from "next/link";
import { useState } from "react";
import { PlugZap, RefreshCw } from "lucide-react";
import type { OwnApiSummary } from "../application/own-api-summary";
import { classifyOwnCall, type OwnOutcome } from "../application/own-api-summary";
import { formatDateTime, formatDayKey } from "../application/format";
import { AdminPageHeader } from "./admin-shell";
import { BarList, ChartCard, ColumnChart, SplitBar, StatTile } from "./charts";
import { useAdminData, useAdminRequest } from "./use-admin-request";

type Connection =
  | { active: false; reason: string }
  | { active: true; host: string; gifts: boolean; primary: string[]; shadow: string[]; timeoutMs: number };
type Call = {
  id: number; created_at: string; action: string; code: string | null; result: boolean | null; decision: string | null;
  duration_ms: number | null; trigger: string; order_id: string | null; validation_id: string | null; error: string | null; http_status: number | null;
};
type OwnApiData = { connection: Connection; days: number; summary: OwnApiSummary; recent: Call[] };

const ACTION_LABELS: Record<string, string> = {
  friend_add: "Validar ID y enviar solicitud", friend_status: "«Ya acepté»", gift_check: "Pre-vuelo", gift_send: "Enviar regalo",
  order_history: "Conciliar", verify_license: "Probar conexión",
};
const OUTCOME_LABELS: Record<OwnOutcome, string> = {
  answered: "Contestó", fallback: "Fue a FN Shop", failed: "Sin respuesta", shadow: "Solo comparación",
};
const label = (action: string) => ACTION_LABELS[action] ?? action;
const numberFormat = (value: number) => value.toLocaleString("es-MX");
const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toLocaleString("es-MX", { maximumFractionDigits: 1 })} s`);

/** Sección «Nuestra API»: qué tanto trabajo ya hace epic-gifting y qué tanto sigue en FN Shop. */
export function OwnApiPanel() {
  const request = useAdminRequest();
  const { data, error, loading, reload } = useAdminData<OwnApiData>("/api/admin/own-api", { refreshMs: 60_000 });
  const [check, setCheck] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function testConnection() {
    setBusy(true); setCheck(null);
    try {
      const body = await request<{ ok: boolean; code: string | null; plan: string | null; ms: number; error?: string }>("/api/admin/own-api", { method: "POST" });
      setCheck(body.ok
        ? { error: false, text: `Nuestra API responde (plan ${body.plan ?? "—"}) en ${seconds(body.ms)}.` }
        : { error: true, text: `No respondió bien: ${body.error ?? body.code ?? "sin respuesta"}.` });
    } catch (cause) {
      setCheck({ error: true, text: cause instanceof Error ? cause.message : "No fue posible probar la conexión." });
    } finally { setBusy(false); }
  }

  const header = <AdminPageHeader title="Nuestra API" lead="Lo que la tienda le pregunta a nuestra API de regalos, qué contestó y cuánto falta para dejar FN Shop."
    actions={<>
      <button type="button" className="ac-ghost" disabled={busy} onClick={() => void testConnection()}><PlugZap aria-hidden="true" size={15} />{busy ? "Probando…" : "Probar conexión"}</button>
      <button type="button" className="ac-ghost" disabled={loading} onClick={() => void reload()}><RefreshCw aria-hidden="true" size={15} />{loading ? "Actualizando…" : "Actualizar"}</button>
    </>} />;

  if (!data) return <>{header}{error ? <p className="ac-notice is-error" role="alert">{error}</p> : <p className="ac-notice">Cargando…</p>}</>;

  const { connection, summary, days } = data;
  const share = summary.share;

  return <>
    {header}
    {check && <p className={`ac-notice${check.error ? " is-error" : " is-success"}`} role="status">{check.text}</p>}
    {error && <p className="ac-notice is-error" role="alert">{error}</p>}

    <section className="ac-card" aria-labelledby="ac-own-mode-title">
      <header className="ac-card-head"><div><h2 id="ac-own-mode-title">Qué va por nuestra API</h2>
        <p>{connection.active ? <>Conectada a <code>{connection.host}</code>. Cambia con las variables <code>OWN_API_*</code> en Vercel.</> : connection.reason}</p></div></header>
      {connection.active && <dl className="ac-own-modes">
        {(["friend_add", "friend_status", "gift_check", "gift_send", "order_history"] as const).map((action) => {
          const mode = (action === "gift_send" || action === "order_history")
            ? (connection.gifts ? (action === "gift_send" ? "Nuestra API. FN Shop solo si la nuestra prueba que no empezó el envío." : "Nuestra API primero; FN Shop solo para pedidos que no conoce.") : "FN Shop (OWN_API_GIFTS apagado)")
            : connection.primary.includes(action) ? "Nuestra API; FN Shop si no puede"
            : connection.shadow.includes(action) ? "FN Shop. La nuestra solo se compara"
            : "FN Shop";
          return <div key={action}><dt>{label(action)}</dt><dd>{mode}</dd></div>;
        })}
      </dl>}
    </section>

    <div className="ac-stats">
      <StatTile label={`Atendidas por nuestra API (${days} días)`} value={share.ownPercent === null ? "—" : `${share.ownPercent} %`}
        hint={`${numberFormat(share.own)} nuestras · ${numberFormat(share.fnshop)} de FN Shop`} />
      <StatTile label="Contestó bien" value={summary.answerRate === null ? "—" : `${summary.answerRate} %`}
        hint={`${numberFormat(summary.totals.fallback)} fueron a FN Shop · ${numberFormat(summary.totals.failed)} sin respuesta`} />
      <StatTile label="Hoy" value={numberFormat(summary.totals.today)} hint="Llamadas a nuestra API, incluidas las de comparación." />
      <StatTile label="Última llamada" value={summary.totals.lastCallAt ? formatDateTime(summary.totals.lastCallAt) : "—"} hint={`${numberFormat(summary.totals.calls)} llamadas en ${days} días.`} />
    </div>

    <div className="ac-grid-2">
      <ChartCard title="Llamadas atendidas por nuestra API" question={`¿Cuántas contestó nuestra API cada día? (${days} días)`}
        table={{ columns: ["Día", "Nuestra API", "FN Shop", "Problemas"], rows: summary.byDay.map((entry) => [formatDayKey(entry.day, { day: "numeric", month: "short" }), entry.own, entry.fnshop, entry.problems]) }}>
        <ColumnChart ariaLabel="Llamadas que contestó nuestra API por día" wholeNumbers formatValue={(value) => `${value} ${value === 1 ? "llamada" : "llamadas"}`} formatTick={(value) => String(value)}
          points={summary.byDay.map((entry) => ({
            key: entry.day, label: formatDayKey(entry.day, { weekday: "long", day: "numeric", month: "long" }), shortLabel: formatDayKey(entry.day), value: entry.own,
            detail: `${entry.fnshop} por FN Shop${entry.problems ? ` · ${entry.problems} con problema` : ""}`,
          }))} />
      </ChartCard>
      <ChartCard title="Quién contestó" question={`De lo que preguntó la tienda en ${days} días (sin contar comparaciones).`}>
        <SplitBar emptyText="Todavía no hay llamadas." parts={[
          { key: "own", label: "Nuestra API", value: share.own, tone: 1 },
          { key: "fnshop", label: "FN Shop", value: share.fnshop, tone: 2 },
        ]} />
      </ChartCard>
    </div>

    <div className="ac-grid-2">
      <ChartCard title="Por llamada" question="Cuántas, cómo terminaron y cuánto tardó nuestra API."
        table={{ columns: ["Llamada", "Total", "Contestó", "A FN Shop", "Sin respuesta", "Comparación", "p50", "p95"], rows: summary.byAction.map((entry) => [label(entry.action), entry.calls, entry.answered, entry.fallback, entry.failed, entry.shadow, seconds(entry.p50), seconds(entry.p95)]) }}>
        <BarList emptyText="Todavía no hay llamadas." rows={summary.byAction.map((entry) => ({
          key: entry.action, label: label(entry.action), value: entry.calls, valueLabel: numberFormat(entry.calls),
          note: [`${entry.answered} contestó`, entry.fallback ? `${entry.fallback} a FN Shop` : "", entry.failed ? `${entry.failed} sin respuesta` : "", entry.shadow ? `${entry.shadow} comparación` : "", `p95 ${seconds(entry.p95)}`].filter(Boolean).join(" · "),
        }))} />
      </ChartCard>
      <ChartCard title="Respuestas" question="Los códigos que devolvió nuestra API.">
        <BarList emptyText="Todavía no hay respuestas." rows={summary.codes.slice(0, 10).map((entry) => ({ key: entry.code, label: entry.code, value: entry.calls, valueLabel: numberFormat(entry.calls) }))} />
      </ChartCard>
    </div>

    <section className="ac-card" aria-labelledby="ac-own-log-title">
      <header className="ac-card-head"><div><h2 id="ac-own-log-title">Bitácora</h2><p>Las últimas 100 llamadas a nuestra API. «Exportar» en FN Shop descarga las dos, con la columna <code>provider</code>.</p></div></header>
      {data.recent.length === 0 ? <p className="ac-empty">Todavía no hay llamadas a nuestra API.</p> : <div className="ac-table-wrap ac-log-wrap"><table className="ac-table ac-log">
        <thead><tr><th scope="col">Cuándo</th><th scope="col">Llamada</th><th scope="col">Respuesta</th><th scope="col">Resultado</th><th scope="col" className="num">s</th><th scope="col">Origen</th><th scope="col">Pedido / ID</th></tr></thead>
        <tbody>{data.recent.map((call) => <tr key={call.id}>
          <th scope="row">{formatDateTime(call.created_at)}</th>
          <td>{label(call.action)}</td>
          <td className="ac-wrap">{call.code ?? (call.error ? `Error: ${call.error}` : call.http_status ? `HTTP ${call.http_status}` : "—")}</td>
          <td>{OUTCOME_LABELS[classifyOwnCall(call)]}</td>
          <td className="num">{seconds(call.duration_ms)}</td>
          <td>{call.trigger === "customer" ? "Cliente" : call.trigger === "admin" ? "Admin" : "Sistema"}</td>
          <td>{call.order_id ? <Link className="ac-link" href={`/admin/pedidos/${call.order_id}`}>Pedido {call.order_id.slice(0, 8).toUpperCase()}</Link> : call.validation_id ? `ID ${call.validation_id.slice(0, 8)}` : "—"}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
