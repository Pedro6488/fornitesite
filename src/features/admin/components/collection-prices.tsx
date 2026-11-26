"use client";

import { useState, type FormEvent } from "react";
import { useAdminData, useAdminRequest } from "./use-admin-request";
import { calculateCollectionPrice } from "@/features/pricing/domain/collection-rate";
import styles from "./collection-prices.module.css";

type Rule = { collection: string; mxn_per_hundred: number | string; active: boolean };
type Data = { configured: boolean; sections: { name: string; count: number }[]; rules: Rule[] };

export function CollectionPrices() {
  const { data, error, loading, reload } = useAdminData<Data>("/api/admin/prices/collections");
  const request = useAdminRequest();
  const [collection, setCollection] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const section = data?.sections.find((entry) => entry.name === collection);
  const sections = [...(data?.sections ?? [])].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const validRate = Number(rate) > 0 && Number.isFinite(Number(rate));
  function choose(name: string) {
    setCollection(name);
    const rule = data?.rules.find((entry) => entry.collection === name);
    setRate(rule ? String(rule.mxn_per_hundred) : "");
    setMessage("");
  }
  async function save(name: string, mxnPerHundred: number, active: boolean) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      await request("/api/admin/prices/collections", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collection: name, mxnPerHundred, active }) });
      await reload();
      setMessage(active ? `Tarifa guardada para toda la colección ${name}.` : `Tarifa desactivada para ${name}.`);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No fue posible guardar la tarifa."); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); if (section && data?.configured) void save(collection, Number(rate), true); }
  return <section className={styles.section} aria-labelledby="collection-prices-heading">
    <header><h2 id="collection-prices-heading">Tarifa para toda una colección</h2>
      <p>Selecciona una colección y define cuántos pesos cobrar por cada 100 paVos. Se aplica a todos sus objetos y a los que se agreguen después.</p>
      <p>Ejemplo: a $7.50 por cada 100 paVos, un objeto de 1,000 paVos cuesta $75 MXN y uno de 1,500 cuesta $113 MXN, redondeado al peso superior.</p>
      <p>Prioridad: precio especial por objeto → tarifa de colección → regla general por rango. Solo cambia precios en MXN; no modifica USD, paVos ni pedidos ya creados.</p>
    </header>
    <button className="ac-ghost" disabled={loading || busy} onClick={() => void reload()}>{loading ? "Actualizando…" : "Actualizar colecciones"}</button>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!data && loading && <p role="status">Cargando colecciones…</p>}
    {data && !data.configured && <p className="notice error" role="alert">Falta aplicar la migración de tarifas por colección antes de guardar reglas.</p>}
    <form onSubmit={submit} className={`price-form ${styles.form}`}>
      <label>Colección completa<select required value={section ? collection : ""} onChange={(event) => choose(event.target.value)} disabled={loading || busy || !data}>
        <option value="">Selecciona una colección</option>
        {sections.map((entry) => <option key={entry.name} value={entry.name}>{entry.name} · {entry.count} objetos</option>)}
      </select></label>
      <label>MXN por cada 100 paVos<input name="collectionRate" type="number" min="0.01" max="99999999.99" step="0.01" placeholder="Escribe tu tarifa" required value={rate} onChange={(event) => setRate(event.target.value)} disabled={busy || !section} /></label>
      {section && <p>Esta regla abarca los {section.count} objetos de {section.name}. No necesitas elegir un objeto.</p>}
      {section && validRate && <p>Con esta tarifa: 1,000 paVos = ${calculateCollectionPrice(1000, Number(rate))} MXN; 1,500 paVos = ${calculateCollectionPrice(1500, Number(rate))} MXN.</p>}
      <button type="submit" className="primary-button" disabled={busy || loading || !data?.configured || !section}>{busy ? "Guardando…" : "Aplicar a toda la colección"}</button>
    </form>
    {message && <p role="status">{message}</p>}
    {data && <p>{data.sections.length} colecciones disponibles en el catálogo actual.</p>}
    <div className={styles.grid} aria-label="Tarifas de colección guardadas">
      {data?.rules.map((rule) => <article className={styles.card} key={rule.collection}>
        <h3>{rule.collection}</h3>
        <p>${Number(rule.mxn_per_hundred).toFixed(2)} MXN por cada 100 paVos · {rule.active ? "Activa" : "Inactiva"}</p>
        {!data.sections.some((entry) => entry.name === rule.collection) && <p>Fuera del catálogo actual</p>}
        <div className={styles.form}>
          {data.sections.some((entry) => entry.name === rule.collection) && <button type="button" className="ac-ghost" disabled={busy} onClick={() => choose(rule.collection)}>Editar tarifa</button>}
          {rule.active && <button type="button" className="ac-ghost" disabled={busy || !data.configured} onClick={() => void save(rule.collection, Number(rule.mxn_per_hundred), false)}>Desactivar</button>}
        </div>
      </article>)}
    </div>
  </section>;
}
