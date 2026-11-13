"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CircleAlert, CircleCheck, RefreshCw } from "lucide-react";
import { formatAge, formatCompactMoney, formatDayKey, formatDuration, formatMoney } from "../application/format";
import { OVERVIEW_RANGES, type OperationsOverview, type OverviewRangeDays, type QueueStat, type Stat } from "../application/operations-overview";
import { AdminPageHeader } from "./admin-shell";
import { BarList, ChartCard, ColumnChart, SplitBar, StatTile, type Delta } from "./charts";
import { useAdminData } from "./use-admin-request";

type OverviewResponse = {
  overview: OperationsOverview;
  store: { activeCarts: number; abandonedCarts: number; favorites: number };
  deliveryMode: "manual" | "automatic";
};

type Measure = "sales" | "paid" | "created";
const MEASURES: Record<Measure, { label: string; title: string; question: string }> = {
  sales: { label: "Ventas", title: "Ventas por día", question: "¿Cuánto dinero entró cada día? Cuenta el día en que se confirmó el pago." },
  paid: { label: "Pagados", title: "Pedidos pagados por día", question: "¿Cuántos pedidos se pagaron cada día?" },
  created: { label: "Creados", title: "Pedidos creados por día", question: "¿Cuántos pedidos iniciaron los clientes cada día, hayan pagado o no?" },
};

const REFRESH_MS = 60_000;

/** Cambio contra el periodo anterior. `upIsGood` decide si subir se pinta como bueno. */
function delta(stat: Stat, previousLabel: string, kind: "percent" | "points" | "minutes", upIsGood = true): Delta | null {
  if (stat.value === null) return null;
  if (stat.previous === null || (kind === "percent" && stat.previous === 0)) return { text: `Sin datos en ${previousLabel}`, direction: "flat", good: null };
  const difference = stat.value - stat.previous;
  if (Math.abs(difference) < 0.5 && kind !== "percent") return { text: `Igual que en ${previousLabel}`, direction: "flat", good: null };
  const sign = difference > 0 ? "+" : "−";
  const amount = kind === "percent" ? `${Math.abs(Math.round((difference / stat.previous) * 100))} %`
    : kind === "points" ? `${Math.abs(Math.round(difference))} pts`
      : formatDuration(Math.abs(difference));
  if (kind === "percent" && Math.round((difference / stat.previous) * 100) === 0) return { text: `Igual que en ${previousLabel}`, direction: "flat", good: null };
  return { text: `${sign}${amount} vs. ${previousLabel}`, direction: difference > 0 ? "up" : "down", good: difference > 0 === upIsGood };
}

function QueueTile({ href, label, queue, idleText, unit }: { href: string; label: string; queue: QueueStat; idleText: string; unit: string }) {
  const busy = queue.count > 0;
  const Icon = busy ? CircleAlert : CircleCheck;
  return <Link href={href} className={`ac-queue${busy ? " is-busy" : ""}`}>
    <span className="ac-queue-label"><Icon aria-hidden="true" size={16} />{label}</span>
    <strong>{queue.count}</strong>
    <small>{busy ? queue.oldestAt ? `${unit} · el más antiguo espera ${formatAge(queue.oldestAt).replace("hace ", "desde hace ")}` : unit : idleText}</small>
  </Link>;
}

export function AdminHome() {
  const [days, setDays] = useState<OverviewRangeDays>(30);
  const [measure, setMeasure] = useState<Measure>("sales");
  const { data, error, loading, reload } = useAdminData<OverviewResponse>(`/api/admin/overview?days=${days}`, { refreshMs: REFRESH_MS });
  const overview = data?.overview;
  const previousLabel = `los ${days} días previos`;

  return <>
    <AdminPageHeader title="Inicio" lead="Lo que hay que atender ahora y cómo va la operación." actions={<>
      <div className="ac-segmented" role="group" aria-label="Periodo">
        {OVERVIEW_RANGES.map((value) => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>{value} días</button>)}
      </div>
      <button type="button" className="ac-ghost" disabled={loading} onClick={() => void reload()}><RefreshCw aria-hidden="true" size={15} />{loading ? "Actualizando…" : "Actualizar"}</button>
    </>} />

    {error && <p className="ac-notice is-error" role="alert">{error}</p>}
    {!overview && !error && <p className="ac-notice">Calculando el tablero…</p>}

    {overview && data && <div className={`ac-home${loading ? " is-refreshing" : ""}`}>
      <section aria-labelledby="ac-now">
        <header className="ac-section-head"><h2 id="ac-now">Por atender ahora</h2><p>Estado actual, sin importar el periodo elegido.</p></header>
        <div className="ac-queues">
          <QueueTile href="/admin/pedidos?cola=payment" label="Comprobantes por revisar" queue={overview.queues.receipts} unit="Confirma el pago" idleText="Ningún comprobante pendiente" />
          <QueueTile href="/admin/pedidos?cola=deliver" label="Pagados por entregar" queue={overview.queues.deliver} unit="Envía el regalo" idleText="Nada por entregar" />
          <QueueTile href="/admin/pedidos?cola=problem" label="Pedidos con problema" queue={overview.queues.problem} unit="Necesitan una decisión" idleText="Sin pedidos detenidos" />
          <QueueTile href="/admin/destinatarios" label="Destinatarios por revisar" queue={overview.queues.recipients} unit="IDs que esperan tu revisión" idleText="Ningún ID pendiente" />
        </div>
        {overview.queues.awaitingCustomer.count > 0 && <p className="ac-footnote">
          Además, {overview.queues.awaitingCustomer.count} {overview.queues.awaitingCustomer.count === 1 ? "pedido espera" : "pedidos esperan"} la transferencia o la respuesta del cliente. No requieren acción tuya.
        </p>}
      </section>

      <section aria-labelledby="ac-kpis">
        <header className="ac-section-head"><h2 id="ac-kpis">Resultados de los últimos {days} días</h2><p>Del {formatDayKey(overview.range.from)} al {formatDayKey(overview.range.to)}, comparado con {previousLabel}.</p></header>
        <div className="ac-stats">
          <StatTile label="Ventas confirmadas" value={formatMoney(overview.kpis.salesMxnCents.value ?? 0)} delta={delta(overview.kpis.salesMxnCents, previousLabel, "percent")} />
          <StatTile label="Pedidos pagados" value={String(overview.kpis.paidOrders.value ?? 0)} delta={delta(overview.kpis.paidOrders, previousLabel, "percent")} />
          <StatTile label="Ticket promedio" value={overview.kpis.averageTicketMxnCents.value === null ? "—" : formatMoney(overview.kpis.averageTicketMxnCents.value)} delta={delta(overview.kpis.averageTicketMxnCents, previousLabel, "percent")} />
          <StatTile label="Pedidos cerrados que se entregaron" value={overview.kpis.completionRate.value === null ? "—" : `${Math.round(overview.kpis.completionRate.value)} %`} delta={delta(overview.kpis.completionRate, previousLabel, "points")} hint="El resto venció, se canceló, se declinó o se reembolsó." />
          <StatTile label="Tiempo en confirmar un pago" value={overview.kpis.paymentReviewMinutes.value === null ? "—" : formatDuration(overview.kpis.paymentReviewMinutes.value)} delta={delta(overview.kpis.paymentReviewMinutes, previousLabel, "minutes", false)} hint="Mediana desde que llega el comprobante." />
          <StatTile label="Tiempo en entregar" value={overview.kpis.deliveryMinutes.value === null ? "—" : formatDuration(overview.kpis.deliveryMinutes.value)} delta={delta(overview.kpis.deliveryMinutes, previousLabel, "minutes", false)} hint="Mediana desde el pago confirmado." />
        </div>
      </section>

      <ChartCard title={MEASURES[measure].title} question={MEASURES[measure].question}
        aside={<div className="ac-segmented" role="group" aria-label="Qué medir">{(Object.keys(MEASURES) as Measure[]).map((value) => <button key={value} type="button" aria-pressed={measure === value} onClick={() => setMeasure(value)}>{MEASURES[value].label}</button>)}</div>}
        table={{ columns: ["Día", "Ventas", "Pedidos pagados", "Pedidos creados"], rows: overview.daily.map((entry) => [formatDayKey(entry.day, { day: "numeric", month: "short", year: "numeric" }), formatMoney(entry.salesMxnCents), entry.paidOrders, entry.createdOrders]) }}>
        <ColumnChart
          ariaLabel={`${MEASURES[measure].title}, últimos ${days} días`}
          wholeNumbers={measure !== "sales"}
          formatValue={measure === "sales" ? formatMoney : (value) => `${value} ${value === 1 ? "pedido" : "pedidos"}`}
          formatTick={measure === "sales" ? formatCompactMoney : (value) => String(value)}
          points={overview.daily.map((entry) => ({
            key: entry.day,
            label: formatDayKey(entry.day, { weekday: "long", day: "numeric", month: "long" }),
            shortLabel: formatDayKey(entry.day),
            value: measure === "sales" ? entry.salesMxnCents : measure === "paid" ? entry.paidOrders : entry.createdOrders,
            detail: measure === "sales" ? `${entry.paidOrders} ${entry.paidOrders === 1 ? "pedido pagado" : "pedidos pagados"}` : undefined,
          }))} />
      </ChartCard>

      <div className="ac-grid-2">
        <ChartCard title="Del pedido a la entrega" question="De los pedidos creados en el periodo, ¿cuántos llegaron a cada paso?"
          table={{ columns: ["Paso", "Pedidos"], rows: [["Pedidos creados", overview.funnel.created], ["Con comprobante", overview.funnel.withReceipt], ["Pago confirmado", overview.funnel.paid], ["Entregados", overview.funnel.delivered], ["Siguen abiertos", overview.outcomes.open], ["Vencidos", overview.outcomes.expired], ["Cancelados", overview.outcomes.canceled], ["Declinados", overview.outcomes.rejected], ["Reembolsados", overview.outcomes.refunded]] }}>
          <BarList emptyText="No se crearon pedidos en este periodo." max={overview.funnel.created} rows={([
            ["created", "Pedidos creados", overview.funnel.created],
            ["receipt", "Con comprobante", overview.funnel.withReceipt],
            ["paid", "Pago confirmado", overview.funnel.paid],
            ["delivered", "Entregados", overview.funnel.delivered],
          ] as const).map(([key, label, value]) => ({ key, label, value, valueLabel: String(value), note: key === "created" || overview.funnel.created === 0 ? undefined : `${Math.round((value / overview.funnel.created) * 100)} % de los creados` }))} />
          {overview.funnel.created > 0 && <p className="ac-footnote">
            No se completaron: {overview.outcomes.expired} vencidos · {overview.outcomes.canceled} cancelados · {overview.outcomes.rejected} declinados · {overview.outcomes.refunded} reembolsados. Siguen abiertos: {overview.outcomes.open}.
          </p>}
        </ChartCard>

        <ChartCard title="A qué hora compran" question="¿En qué horas del día se crean más pedidos? Hora de Ciudad de México."
          table={{ columns: ["Hora", "Pedidos"], rows: overview.hourly.map((entry) => [`${String(entry.hour).padStart(2, "0")}:00`, entry.orders]) }}>
          <ColumnChart ariaLabel={`Pedidos creados por hora del día, últimos ${days} días`} wholeNumbers height={200}
            formatValue={(value) => `${value} ${value === 1 ? "pedido" : "pedidos"}`} formatTick={(value) => String(value)}
            points={overview.hourly.map((entry) => ({ key: String(entry.hour), label: `De ${String(entry.hour).padStart(2, "0")}:00 a ${String(entry.hour).padStart(2, "0")}:59`, shortLabel: `${entry.hour} h`, value: entry.orders }))} />
        </ChartCard>
      </div>

      <div className="ac-grid-2">
        <ChartCard title="Objetos más vendidos" question="¿Qué se vende más? Unidades en pedidos pagados del periodo."
          table={{ columns: ["Objeto", "Unidades", "Ventas"], rows: overview.topItems.map((item) => [item.name, item.units, formatMoney(item.salesMxnCents)]) }}>
          <BarList emptyText="Aún no hay ventas en este periodo." rows={overview.topItems.map((item) => ({
            key: item.mainId, label: item.name, value: item.units, valueLabel: `${item.units} ${item.units === 1 ? "unidad" : "unidades"}`, note: formatMoney(item.salesMxnCents),
            lead: <span className="ac-thumb">{item.imageUrl ? <Image src={item.imageUrl} alt="" width={36} height={36} unoptimized /> : <b aria-hidden="true">{item.name.slice(0, 1)}</b>}</span>,
          }))} />
        </ChartCard>

        <div className="ac-stack">
          <ChartCard title="Clientes del periodo" question="¿Quién compró: destinatarios nuevos o que ya habían recibido antes?">
            <SplitBar emptyText="Aún no hay compras en este periodo." parts={[
              { key: "returning", label: "Ya habían comprado", value: overview.customers.returningRecipients, tone: 1 },
              { key: "new", label: "Primera compra", value: overview.customers.newRecipients, tone: 2 },
            ]} />
          </ChartCard>

          <section className="ac-card" aria-labelledby="ac-recipients">
            <header className="ac-card-head"><div><h2 id="ac-recipients">Destinatarios</h2><p>¿A cuántos IDs ya se les puede enviar un regalo?</p></div><Link className="ac-ghost" href="/admin/destinatarios">Abrir</Link></header>
            <dl className="ac-figures">
              <div><dt>Listos para recibir</dt><dd>{overview.recipients.ready}</dd></div>
              <div><dt>En espera de 48 h</dt><dd>{overview.recipients.waiting}</dd></div>
              <div><dt>Solicitud sin aceptar</dt><dd>{overview.recipients.pendingFriendship}</dd></div>
              <div><dt>Por revisar</dt><dd>{overview.recipients.manualReview}</dd></div>
              <div><dt>Bloqueados</dt><dd>{overview.recipients.blocked}</dd></div>
            </dl>
            <p className="ac-footnote">
              {overview.recipients.releasingIn24h} {overview.recipients.releasingIn24h === 1 ? "termina" : "terminan"} su espera en las próximas 24 h
              {overview.recipients.waitExpired > 0 ? ` · ${overview.recipients.waitExpired} ya la ${overview.recipients.waitExpired === 1 ? "cumplió" : "cumplieron"} y falta marcarlos como listos` : ""}.
            </p>
          </section>

          <section className="ac-card" aria-labelledby="ac-store">
            <header className="ac-card-head"><div><h2 id="ac-store">Intención de compra</h2><p>¿Cuánta gente tiene algo guardado sin haber pedido?</p></div></header>
            <dl className="ac-figures">
              <div><dt><Link href="/admin/carritos">Carritos con actividad</Link></dt><dd>{data.store.activeCarts}</dd></div>
              <div><dt><Link href="/admin/carritos">Carritos sin actividad +24 h</Link></dt><dd>{data.store.abandonedCarts}</dd></div>
              <div><dt><Link href="/admin/favoritos">Favoritos guardados</Link></dt><dd>{data.store.favorites}</dd></div>
            </dl>
          </section>
        </div>
      </div>

      <p className="ac-footnote">Actualizado {formatAge(overview.generatedAt)} · se actualiza solo cada minuto mientras esta pestaña está visible. Todo sale de la base de datos de la tienda.</p>
    </div>}
  </>;
}
