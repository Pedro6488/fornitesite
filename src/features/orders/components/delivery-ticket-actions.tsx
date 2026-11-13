"use client";

import { useState } from "react";
import type { OrderStatus } from "../domain/order";

export type TicketOrderItem = { item_name: string; item_image_url: string | null; vbucks_price: number; quantity: number; unit_amount_mxn_cents: number };
export type TicketOrder = { id: string; created_at: string; epic_display_name: string; amount_mxn_cents: number; status: OrderStatus; order_items: TicketOrderItem[] };
type Order = TicketOrder;

const formatMoney = (cents: number) => (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const paidTicketStatuses: readonly OrderStatus[] = ["paid", "ready_to_send", "validating_delivery", "delivering", "reconciling", "delivered"];

export function DeliveryTicketActions({ order }: { order: Order }) {
  const [creating, setCreating] = useState<"image" | "pdf" | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const ready = paidTicketStatuses.includes(order.status);

  async function downloadImage() {
    setCreating("image");
    setTicketError(null);
    try {
      const canvas = await createTicketCanvas(order);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("No fue posible crear la imagen.")), "image/png"));
      const filename = `ticket-pedido-${order.id.slice(0, 8).toUpperCase()}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Ticket pedido #${order.id.slice(0, 8).toUpperCase()}` });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          // Some mobile browsers report file sharing support but reject it
          // after generating the canvas. The link fallback still lets users
          // download it or open it and save it from the image viewer.
        }
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = objectUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setTicketError("No fue posible compartir o descargar la imagen. Intenta nuevamente.");
    } finally { setCreating(null); }
  }

  function savePdf() {
    setCreating("pdf");
    try {
      const printWindow = window.open("", "_blank", "width=760,height=900");
      if (!printWindow) return;
      printWindow.opener = null;
      const document = ticketPrintDocument(order);
      printWindow.document.write(order.status === "delivered"
        ? document.replace("COMPRA CONFIRMADA", "PRODUCTOS ENTREGADOS").replace("Pago confirmado.", "Productos entregados.")
        : document);
      printWindow.document.close();
      printWindow.focus();
    } finally { window.setTimeout(() => setCreating(null), 300); }
  }

  return <section className="delivery-ticket-actions">
    <div><p className="eyebrow">TICKET PARA EL CLIENTE</p><h3>Comprobante de compra y entrega</h3><p>Incluye el pedido, total, receptor y todos los objetos que deben entregarse.</p></div>
    <div className="delivery-ticket-buttons"><button type="button" className="ticket-image" disabled={!ready || creating !== null} onClick={() => void downloadImage()}>{creating === "image" ? "Generando imagen…" : "Compartir o descargar imagen"}</button><button type="button" className="ticket-pdf" disabled={!ready || creating !== null} onClick={savePdf}>{creating === "pdf" ? "Abriendo PDF…" : "Guardar como PDF"}</button></div>
    {ticketError && <small className="notice error">{ticketError}</small>}
    {!ready && <small>El ticket queda disponible cuando el pago esté confirmado.</small>}
  </section>;
}

async function createTicketCanvas(order: Order) {
  const delivered = order.status === "delivered";
  const ticketTitle = delivered ? "SIGFRIEDLOOTBOX · PRODUCTOS ENTREGADOS" : "SIGFRIEDLOOTBOX · COMPRA CONFIRMADA";
  const ticketFooter = delivered ? "PRODUCTOS ENTREGADOS" : "PAGO CONFIRMADO";
  const width = 1080;
  const height = 570 + order.order_items.length * 104;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No fue posible crear el ticket.");
  context.fillStyle = "#091020"; context.fillRect(0, 0, width, height);
  context.fillStyle = "#151f40"; context.fillRect(38, 38, width - 76, height - 76);
  context.strokeStyle = "#2c4678"; context.lineWidth = 2; context.strokeRect(38, 38, width - 76, height - 76);
  context.fillStyle = "#ffd51f"; context.font = "900 22px Arial"; context.fillText(ticketTitle, 84, 100);
  context.fillStyle = "#f6f8ff"; context.font = "900 48px Arial"; context.fillText(`PEDIDO #${order.id.slice(0, 8).toUpperCase()}`, 84, 165);
  context.fillStyle = "#aebddd"; context.font = "24px Arial"; context.fillText(new Date(order.created_at).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }), 84, 210);
  context.fillStyle = "#55d9ff"; context.font = "900 20px Arial"; context.fillText("RECEPTOR", 84, 278);
  context.fillStyle = "#f6f8ff"; context.font = "900 32px Arial"; context.fillText(order.epic_display_name, 84, 320);
  context.fillStyle = "#ffd51f"; context.font = "900 43px Arial"; context.textAlign = "right"; context.fillText(formatMoney(order.amount_mxn_cents), width - 84, 320); context.textAlign = "left";
  context.strokeStyle = "#344365"; context.beginPath(); context.moveTo(84, 360); context.lineTo(width - 84, 360); context.stroke();
  context.fillStyle = "#55d9ff"; context.font = "900 20px Arial"; context.fillText("PRODUCTOS A ENTREGAR", 84, 405);
  const artwork = await Promise.all(order.order_items.map((item) => loadTicketArtwork(item.item_image_url)));
  order.order_items.forEach((item, index) => {
    const top = 430 + index * 96;
    context.fillStyle = "#0d1630"; context.fillRect(84, top, width - 168, 80);
    const image = artwork[index];
    if (image) context.drawImage(image, 94, top + 8, 64, 64);
    else { context.fillStyle = "#20345d"; context.fillRect(94, top + 8, 64, 64); context.fillStyle = "#55d9ff"; context.font = "900 26px Arial"; context.fillText(item.item_name.slice(0, 1).toUpperCase(), 117, top + 49); }
    context.fillStyle = "#eef2ff"; context.font = "900 23px Arial"; context.fillText(item.item_name, 178, top + 34);
    context.fillStyle = "#aebddd"; context.font = "19px Arial"; context.fillText(`${item.quantity}× · ◉ ${item.vbucks_price.toLocaleString("es-MX")} paVos`, 178, top + 60);
    context.fillStyle = "#ffd51f"; context.font = "900 23px Arial"; context.textAlign = "right"; context.fillText(formatMoney(item.unit_amount_mxn_cents * item.quantity), width - 104, top + 47); context.textAlign = "left";
  });
  context.fillStyle = "#9cffcf"; context.font = "900 20px Arial"; context.fillText(ticketFooter, 84, height - 84);
  context.fillStyle = "#9aa9c9"; context.font = "18px Arial"; context.textAlign = "right"; context.fillText("Guarda este ticket como comprobante de tu compra.", width - 84, height - 84); context.textAlign = "left";
  return canvas;
}

async function loadTicketArtwork(url: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const objectUrl = URL.createObjectURL(await response.blob());
    const image = document.createElement("img");
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("image_load_failed")); image.src = objectUrl; });
    URL.revokeObjectURL(objectUrl);
    return image;
  } catch { return null; }
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character); }

function ticketPrintDocument(order: Order) {
  const id = order.id.slice(0, 8).toUpperCase();
  const items = order.order_items.map((item) => `<li>${item.item_image_url ? `<img src="${escapeHtml(item.item_image_url)}" alt="">` : "<i>□</i>"}<span><b>${item.quantity}× ${escapeHtml(item.item_name)}</b><small>◉ ${item.vbucks_price.toLocaleString("es-MX")} paVos</small></span><strong>${formatMoney(item.unit_amount_mxn_cents * item.quantity)}</strong></li>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ticket ${id}</title><style>body{background:#fff;color:#101522;font-family:Arial,sans-serif;margin:0}.ticket{border:1px solid #d6dce8;margin:32px auto;max-width:620px;padding:32px}.eyebrow{color:#236fe3;font-size:11px;font-weight:800;letter-spacing:1.4px}.header{border-bottom:1px solid #d6dce8;display:flex;justify-content:space-between;padding-bottom:20px}.header h1{font-size:25px;margin:8px 0}.amount{color:#d89500;font-size:30px;font-weight:900}.receiver{background:#f2f7ff;margin:22px 0;padding:16px}.receiver b{display:block;font-size:18px;margin-top:5px}ul{border-bottom:1px solid #d6dce8;border-top:1px solid #d6dce8;list-style:none;margin:18px 0;padding:10px 0}li{align-items:center;display:flex;gap:12px;padding:10px 0}li img,li i{background:#eef3fc;border-radius:7px;display:block;font-style:normal;height:52px;object-fit:contain;width:52px}li span{display:grid;flex:1;gap:4px}li small{color:#52627f;font-size:12px}li strong{white-space:nowrap}footer{color:#52627f;font-size:12px;margin-top:22px}@media print{.ticket{border:0;margin:0;max-width:none}}</style></head><body><main class="ticket"><p class="eyebrow">SIGFRIEDLOOTBOX · COMPRA CONFIRMADA</p><div class="header"><div><h1>Pedido #${id}</h1><small>${new Date(order.created_at).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}</small></div><strong class="amount">${formatMoney(order.amount_mxn_cents)}</strong></div><section class="receiver"><span>RECEPTOR DE LA ENTREGA</span><b>${escapeHtml(order.epic_display_name)}</b></section><h2>Productos a entregar</h2><ul>${items}</ul><footer>Pago confirmado. Guarda este ticket como comprobante de tu compra.</footer><script>window.addEventListener('load',function(){setTimeout(function(){window.print()},250)})<\/script></main></body></html>`;
}
