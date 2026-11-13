"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Table2, ChartColumn } from "lucide-react";

/**
 * Gráficas de la consola, dibujadas con SVG y HTML sin librerías.
 * Reglas: una sola serie = un solo color; el valor nunca depende solo del
 * cursor (cada tarjeta tiene su vista de tabla) y los textos no usan el color de la serie.
 */

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Tope del eje y separación entre marcas, en números redondos. */
function niceScale(max: number, targetTicks = 4): { max: number; step: number } {
  if (max <= 0) return { max: 1, step: 1 };
  const rough = max / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= rough) ?? 10) * magnitude;
  return { max: Math.ceil(max / step) * step, step };
}

export type ChartPoint = { key: string; label: string; shortLabel: string; value: number; detail?: string };

export function ColumnChart({ points, formatValue, formatTick = formatValue, ariaLabel, height = 220, wholeNumbers = false }: {
  points: readonly ChartPoint[];
  formatValue: (value: number) => string;
  formatTick?: (value: number) => string;
  ariaLabel: string;
  height?: number;
  /** Para conteos: el eje no muestra fracciones. */
  wholeNumbers?: boolean;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const margin = { top: 22, right: 8, bottom: 24, left: 46 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const band = points.length ? innerWidth / points.length : 0;
  const barWidth = Math.max(2, Math.min(24, band - 2));
  const highest = Math.max(0, ...points.map((point) => point.value));
  const scale = niceScale(wholeNumbers ? Math.max(highest, 4) : highest);
  const ticks = Array.from({ length: Math.round(scale.max / scale.step) + 1 }, (_, index) => index * scale.step);
  const y = (value: number) => margin.top + innerHeight - (value / scale.max) * innerHeight;
  const labelEvery = Math.max(1, Math.ceil(46 / Math.max(band, 1)));
  const peak = highest > 0 ? points.findIndex((point) => point.value === highest) : -1;
  const focused = active === null ? null : points[active];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setActive((current) => {
      const start = current ?? points.length - 1;
      return Math.max(0, Math.min(points.length - 1, start + (event.key === "ArrowRight" ? 1 : -1)));
    });
  }

  return <div className="ac-chart" ref={ref} tabIndex={0} role="group" aria-label={`${ariaLabel}. Usa las flechas izquierda y derecha para leer cada valor.`}
    onKeyDown={onKeyDown} onFocus={() => setActive((current) => current ?? points.length - 1)} onBlur={() => setActive(null)} onPointerLeave={() => setActive(null)}>
    {width > 0 && <svg width={width} height={height} role="img" aria-label={ariaLabel}>
      {ticks.map((tick) => <g key={tick}>
        <line className={tick === 0 ? "ac-chart-axis" : "ac-chart-grid"} x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
        <text className="ac-chart-tick" x={margin.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">{formatTick(tick)}</text>
      </g>)}
      {points.map((point, index) => {
        const x = margin.left + band * index + (band - barWidth) / 2;
        const top = y(point.value);
        const barHeight = margin.top + innerHeight - top;
        const radius = Math.min(4, barWidth / 2, barHeight);
        return <g key={point.key}>
          {barHeight > 0 && <path className={`ac-chart-bar${active === index ? " is-active" : ""}`}
            d={`M${x},${top + barHeight} V${top + radius} Q${x},${top} ${x + radius},${top} H${x + barWidth - radius} Q${x + barWidth},${top} ${x + barWidth},${top + radius} V${top + barHeight} Z`} />}
          {(points.length - 1 - index) % labelEvery === 0 && <text className="ac-chart-tick" x={margin.left + band * (index + 0.5)} y={height - 6} textAnchor="middle">{point.shortLabel}</text>}
          {index === peak && active === null && <text className="ac-chart-peak" x={Math.max(margin.left + 24, Math.min(width - margin.right - 24, margin.left + band * (index + 0.5)))} y={top - 7} textAnchor="middle">{formatValue(point.value)}</text>}
          <rect className="ac-chart-hit" x={margin.left + band * index} y={margin.top} width={band} height={innerHeight} onPointerEnter={() => setActive(index)} onPointerMove={() => setActive(index)} />
        </g>;
      })}
    </svg>}
    {highest === 0 && width > 0 && <p className="ac-chart-empty">Sin movimiento en este periodo.</p>}
    {focused && active !== null && <div className="ac-chart-tooltip" role="status" style={{ left: Math.max(70, Math.min(width - 70, margin.left + band * (active + 0.5))), top: Math.max(0, y(focused.value) - 12) }}>
      <strong>{formatValue(focused.value)}</strong>
      <span>{focused.label}</span>
      {focused.detail && <span>{focused.detail}</span>}
    </div>}
  </div>;
}

export type BarRow = { key: string; label: string; value: number; valueLabel: string; note?: string; lead?: ReactNode };

/** Barras horizontales ordenadas: comparar cantidades entre nombres. El valor va escrito al final de cada barra. */
export function BarList({ rows, max, emptyText }: { rows: readonly BarRow[]; max?: number; emptyText: string }) {
  const top = max ?? Math.max(0, ...rows.map((row) => row.value));
  if (!rows.length || top === 0) return <p className="ac-empty">{emptyText}</p>;
  return <ol className="ac-barlist">
    {rows.map((row) => <li key={row.key}>
      {row.lead}
      <div className="ac-barlist-body">
        <p><span title={row.label}>{row.label}</span><strong>{row.valueLabel}</strong></p>
        <div className="ac-barlist-track"><span style={{ width: `${Math.max(row.value > 0 ? 1.5 : 0, (row.value / top) * 100)}%` }} /></div>
        {row.note && <small>{row.note}</small>}
      </div>
    </li>)}
  </ol>;
}

export type SplitPart = { key: string; label: string; value: number; tone: 1 | 2 };

/** Un total repartido en dos partes; las cifras van en la lista de abajo, cada una con su muestra de color. */
export function SplitBar({ parts, emptyText }: { parts: readonly SplitPart[]; emptyText: string }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (total === 0) return <p className="ac-empty">{emptyText}</p>;
  return <div className="ac-split">
    <div className="ac-split-bar" role="img" aria-label={parts.map((part) => `${part.label}: ${part.value}`).join(", ")}>
      {parts.filter((part) => part.value > 0).map((part) => <span key={part.key} className={`tone-${part.tone}`} style={{ flexGrow: part.value }} />)}
    </div>
    <ul>
      {parts.map((part) => <li key={part.key}><i className={`tone-${part.tone}`} aria-hidden="true" /><span>{part.label}</span><strong>{part.value}</strong><small>{Math.round((part.value / total) * 100)} %</small></li>)}
    </ul>
  </div>;
}

export type Delta = { text: string; direction: "up" | "down" | "flat"; good: boolean | null };

export function StatTile({ label, value, delta, hint }: { label: string; value: string; delta?: Delta | null; hint?: string }) {
  const Icon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : Minus;
  return <article className="ac-stat">
    <small>{label}</small>
    <strong>{value}</strong>
    {delta && <p className={`ac-delta${delta.good === null ? "" : delta.good ? " is-good" : " is-bad"}`}><Icon aria-hidden="true" size={14} />{delta.text}</p>}
    {hint && <p className="ac-stat-hint">{hint}</p>}
  </article>;
}

/** Marco de una gráfica: título, la pregunta que responde y su tabla equivalente. */
export function ChartCard({ title, question, children, table, aside, className = "" }: {
  title: string;
  question: string;
  children: ReactNode;
  table?: { columns: readonly string[]; rows: readonly (readonly (string | number)[])[] };
  aside?: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  return <section className={`ac-card ${className}`.trim()} aria-labelledby={titleId}>
    <header className="ac-card-head">
      <div><h2 id={titleId}>{title}</h2><p>{question}</p></div>
      <div className="ac-card-tools">
        {aside}
        {table && <button type="button" className="ac-ghost" aria-pressed={showTable} onClick={() => setShowTable((current) => !current)}>
          {showTable ? <ChartColumn aria-hidden="true" size={15} /> : <Table2 aria-hidden="true" size={15} />}{showTable ? "Ver gráfica" : "Ver tabla"}
        </button>}
      </div>
    </header>
    {showTable && table ? <div className="ac-table-wrap"><table className="ac-table">
      <thead><tr>{table.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
      <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => cellIndex === 0 ? <th key={cellIndex} scope="row">{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
    </table></div> : children}
  </section>;
}
