"use client";

import { useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import { formatMxn } from "@/features/pricing/domain/price-calculator";

type Transfer = { id: string; item_name: string; epic_display_name: string; amount_mxn_cents: number; status: string; receipt: null | { sender_bank: string; sender_name: string; transfer_reference: string; signedUrl: string | null } };

export function AdminTransfers() {
  const supabase = useMemo(() => getSupabaseBrowser(), []); const [transfers, setTransfers] = useState<Transfer[]>([]); const [message, setMessage] = useState("Presiona actualizar para consultar las transferencias.");
  async function load() {
    if (!supabase) { setMessage("Supabase Auth todavía no está configurado."); return; }
    const session = (await supabase.auth.getSession()).data.session; if (!session) { setMessage("Inicia sesión con una cuenta de operador."); return; }
    const response = await fetch("/api/admin/transfers", { headers: { Authorization: `Bearer ${session.access_token}` } }); const body = await response.json();
    if (!response.ok) { setMessage(body.error); return; } setTransfers(body.transfers); setMessage(body.transfers.length ? "" : "No hay transferencias pendientes.");
  }
  async function action(orderId: string, actionName: "approve" | "reject") {
    if (!supabase) return; const session = (await supabase.auth.getSession()).data.session; if (!session) return; const notes = actionName === "reject" ? window.prompt("Motivo del rechazo") : null; if (actionName === "reject" && !notes) return;
    const response = await fetch(`/api/admin/transfers/${orderId}/${actionName}`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: actionName === "reject" ? JSON.stringify({ notes }) : undefined }); const body = await response.json();
    setMessage(response.ok ? "Operación registrada." : body.error); if (response.ok) await load();
  }
  return <div className="admin-list"><button className="secondary-button" onClick={load}>Actualizar transferencias</button>{message && <p className="notice">{message}</p>}{transfers.map((transfer) => <article className="admin-transfer" key={transfer.id}><div><p className="eyebrow">{transfer.status}</p><h2>{transfer.item_name}</h2><span>{transfer.epic_display_name} · {formatMxn(transfer.amount_mxn_cents / 100)}</span></div>{transfer.receipt && <div><p>{transfer.receipt.sender_name}</p><p>{transfer.receipt.sender_bank} · {transfer.receipt.transfer_reference}</p>{transfer.receipt.signedUrl && <a href={transfer.receipt.signedUrl} target="_blank" rel="noreferrer">Ver comprobante</a>}</div>}<div className="admin-actions"><button onClick={() => action(transfer.id, "approve")}>Aprobar</button><button onClick={() => action(transfer.id, "reject")}>Rechazar</button></div></article>)}</div>;
}
