"use client";

import { useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import { formatMxn } from "@/features/pricing/domain/price-calculator";
import { AdminActionModal } from "@/shared/components/admin-action-modal";

type Transfer = { id: string; item_name: string; epic_display_name: string; amount_mxn_cents: number; status: string; receipt: null | { sender_bank: string; sender_name: string; transfer_reference: string; signedUrl: string | null } };

export function AdminTransfers() {
  const supabase = useMemo(() => getSupabaseBrowser(), []); const [transfers, setTransfers] = useState<Transfer[]>([]); const [message, setMessage] = useState("Presiona actualizar para consultar las transferencias."); const [pending, setPending] = useState<{ transfer: Transfer; action: "approve" | "reject" } | null>(null);
  async function load() {
    if (!supabase) { setMessage("Supabase Auth todavía no está configurado."); return; }
    const session = (await supabase.auth.getSession()).data.session; if (!session) { setMessage("Inicia sesión con una cuenta de operador."); return; }
    const response = await fetch("/api/admin/transfers", { headers: { Authorization: `Bearer ${session.access_token}` } }); const body = await response.json();
    if (!response.ok) { setMessage(body.error); return; } setTransfers(body.transfers); setMessage(body.transfers.length ? "" : "No hay transferencias pendientes.");
  }
  async function action(orderId: string, actionName: "approve" | "reject", notes = "") {
    if (!supabase) return; const session = (await supabase.auth.getSession()).data.session; if (!session) return;
    const response = await fetch(`/api/admin/transfers/${orderId}/${actionName}`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: actionName === "reject" ? JSON.stringify({ notes }) : undefined }); const body = await response.json();
    setMessage(response.ok ? "Operación registrada." : body.error); if (response.ok) await load();
  }
  return <div className="admin-list"><button className="secondary-button" onClick={load}>Actualizar transferencias</button>{message && <p className="notice">{message}</p>}{transfers.map((transfer) => <article className="admin-transfer" key={transfer.id}><div><p className="eyebrow">{transfer.status}</p><h2>{transfer.item_name}</h2><span>{transfer.epic_display_name} · {formatMxn(transfer.amount_mxn_cents / 100)}</span></div>{transfer.receipt && <div><p>{transfer.receipt.sender_name}</p><p>{transfer.receipt.sender_bank} · {transfer.receipt.transfer_reference}</p>{transfer.receipt.signedUrl && <a href={transfer.receipt.signedUrl} target="_blank" rel="noreferrer">Ver comprobante</a>}</div>}<div className="admin-actions"><button onClick={() => setPending({ transfer, action: "approve" })}>Aprobar</button><button onClick={() => setPending({ transfer, action: "reject" })}>Rechazar</button></div></article>)}<AdminActionModal open={Boolean(pending)} onClose={() => setPending(null)} title={pending?.action === "reject" ? "Rechazar transferencia" : "Aprobar transferencia"} description={pending ? `${pending.transfer.item_name} · ${formatMxn(pending.transfer.amount_mxn_cents / 100)}` : ""} confirmLabel={pending?.action === "reject" ? "Rechazar" : "Aprobar"} tone={pending?.action === "reject" ? "danger" : "primary"} notesLabel={pending?.action === "reject" ? "Motivo del rechazo" : undefined} notesPlaceholder="Explica al cliente por qué no se aprobó el pago." notesRequired={pending?.action === "reject"} onConfirm={(notes) => { if (!pending) return; const next = pending; setPending(null); void action(next.transfer.id, next.action, notes); }} /></div>;
}
