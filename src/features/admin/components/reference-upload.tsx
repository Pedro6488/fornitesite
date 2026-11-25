"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAdminData, useAdminRequest } from "./use-admin-request";
import styles from "./reference-upload.module.css";

type Order = { id: string; epic_display_name: string; order_items: { item_name: string }[] };

export function ReferenceUpload({ onPublished }: { onPublished: () => Promise<void> }) {
  const request = useAdminRequest();
  const { data, error, loading } = useAdminData<{ orders: Order[] }>("/api/admin/orders?queue=closed&result=delivered&limit=500");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    try {
      await request("/api/admin/references", { method: "POST", body: new FormData(form) });
      form.reset();
      setPreview("");
      setMessage("Referencia publicada. Ya aparece en el inicio y en Referencias.");
      await onPublished();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No fue posible publicar."); }
    finally { setBusy(false); }
  }
  return <form className="price-form" onSubmit={submit}>
    <h2>Publicar confirmación del chat</h2>
    <p>La captura se mostrará públicamente en el carrusel del inicio y en Referencias. Oculta teléfonos y datos personales antes de subirla.</p>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, display: "grid", gap: 16, minWidth: 0 }}>
      <label>Usuario y objetos entregados
        <span className={styles.selectWrap}>
          <select className={styles.select} name="orderId" required defaultValue="" disabled={loading || !data?.orders.length}>
            <option value="" disabled>{loading ? "Cargando entregas…" : data?.orders.length ? "Selecciona el usuario y los objetos" : "No hay entregas disponibles"}</option>
            {data?.orders.map((order) => <option key={order.id} value={order.id}>{order.epic_display_name} · {order.order_items.map((item) => item.item_name).join(", ")}</option>)}
          </select>
          <span className={styles.arrow} aria-hidden="true">▾</span>
        </span>
      </label>
      <small>Se muestran las últimas 500 entregas por usuario y objetos. Se cuenta una referencia por pedido.</small>
      {error && <p role="alert">{error}</p>}
      <label>Captura de confirmación<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => { const file = event.target.files?.[0]; setPreview(file ? URL.createObjectURL(file) : ""); }} /></label>
      <small>JPG, PNG o WEBP, máximo 5 MB.</small>
      {preview && <img src={preview} alt="Vista previa de la captura que se publicará" style={{ maxWidth: "100%", maxHeight: 360, objectFit: "contain" }} />}
      <label>Comentario opcional<textarea name="comment" maxLength={1000} rows={3} /></label>
      <button className="primary-button" type="submit">{busy ? "Publicando…" : "Publicar referencia"}</button>
    </fieldset>
    {message && <p role="status">{message}</p>}
  </form>;
}
