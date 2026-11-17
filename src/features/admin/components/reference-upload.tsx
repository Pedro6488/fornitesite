"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAdminData, useAdminRequest } from "./use-admin-request";

type Order = { id: string; epic_display_name: string; order_items: { item_name: string }[] };

export function ReferenceUpload({ onPublished }: { onPublished: () => Promise<void> }) {
  const request = useAdminRequest();
  const { data, error } = useAdminData<{ orders: Order[] }>("/api/admin/orders?queue=closed&result=delivered&limit=500");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    try {
      await request("/api/admin/references", { method: "POST", body: new FormData(form) });
      form.reset();
      setFile(null);
      setMessage("Referencia publicada. Ya aparece en el inicio y en Referencias.");
      await onPublished();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No fue posible publicar."); }
    finally { setBusy(false); }
  }
  return <form className="price-form" onSubmit={submit}>
    <h2>Publicar confirmación del chat</h2>
    <p>La captura se mostrará públicamente en el carrusel del inicio y en Referencias. Oculta teléfonos y datos personales antes de subirla.</p>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, display: "grid", gap: 16, minWidth: 0 }}>
      <label>Pedido entregado<input name="orderId" list="reference-orders" required placeholder="Selecciona o pega el ID del pedido" /></label>
      <datalist id="reference-orders">{data?.orders.map((order) => <option key={order.id} value={order.id}>{order.epic_display_name} · {order.order_items.map((item) => item.item_name).join(", ")}</option>)}</datalist>
      <small>Se sugieren los últimos 500 pedidos entregados. También puedes pegar el ID de un pedido anterior. Se cuenta una referencia por pedido.</small>
      {error && <p role="alert">{error}</p>}
      <label>Captura de confirmación<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <small>JPG, PNG o WEBP, máximo 5 MB.</small>
      {preview && <img src={preview} alt="Vista previa de la captura que se publicará" style={{ maxWidth: "100%", maxHeight: 360, objectFit: "contain" }} />}
      <label>Comentario opcional<textarea name="comment" maxLength={1000} rows={3} /></label>
      <button className="primary-button" type="submit">{busy ? "Publicando…" : "Publicar referencia"}</button>
    </fieldset>
    {message && <p role="status">{message}</p>}
  </form>;
}
