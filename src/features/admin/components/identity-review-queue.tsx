"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, Clock3, RefreshCw, ScanLine } from "lucide-react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

type IdentityReview = {
  id: string; platform: string; submitted_id: string; epic_account_id: string; display_name: string;
  status: "pending_friendship" | "waiting" | "ready" | "manual_review" | "blocked";
  giftable_at: string | null; last_checked_at: string; created_at: string; reviewed_at: string | null;
  review_note: string | null; user_id: string | null;
  orders: { id: string; status: string; created_at: string; item_name: string }[];
};

const statusText: Record<IdentityReview["status"], string> = {
  pending_friendship: "Solicitud pendiente", waiting: "En espera de 48 h", ready: "ID validado",
  manual_review: "Por revisar", blocked: "Bloqueado"
};

export function IdentityReviewQueue() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [validations, setValidations] = useState<IdentityReview[]>([]);
  const [message, setMessage] = useState("Cargando IDs…");
  const [updating, setUpdating] = useState<string | null>(null);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session) throw new Error("La sesión de administrador expiró.");
    const response = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "No fue posible completar la revisión.");
    return body;
  }, [supabase]);

  const load = useCallback(async () => {
    setMessage("Cargando IDs…");
    try {
      const body = await request("/api/admin/validations");
      setValidations(body.validations ?? []);
      setMessage(body.validations?.length ? "" : "No hay IDs para revisar todavía.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar los IDs."); }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  async function review(validation: IdentityReview, status: "ready" | "blocked") {
    const notes = status === "blocked" ? window.prompt("Motivo para bloquear el ID")?.trim() : window.prompt("Nota interna opcional para la aprobación")?.trim();
    if (status === "blocked" && (!notes || notes.length < 3)) return;
    if (status === "ready" && !window.confirm(`¿Confirmas que ${validation.display_name} está listo para recibir futuras entregas?`)) return;
    setUpdating(validation.id);
    try {
      await request(`/api/admin/validations/${validation.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, notes }) });
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar la revisión."); }
    finally { setUpdating(null); }
  }

  const pending = validations.filter((entry) => entry.status !== "ready");
  const ready = validations.filter((entry) => entry.status === "ready");
  return <section className="identity-review-queue">
    <header className="identity-review-heading"><div><p className="eyebrow">IDENTIDADES DE ENTREGA</p><h2>Revisión de IDs</h2><p>Aprueba IDs con 48 horas cumplidas o que ya recibieron una entrega.</p></div><button type="button" className="secondary-button" onClick={() => void load()}><RefreshCw aria-hidden="true" size={16} />Actualizar</button></header>
    {message && <p className="notice">{message}</p>}
    {pending.length > 0 && <div className="identity-review-grid">{pending.map((entry) => <IdentityReviewCard key={entry.id} validation={entry} updating={updating === entry.id} onReview={review} />)}</div>}
    {ready.length > 0 && <section className="identity-approved-list"><p className="eyebrow">YA VALIDADOS</p><div>{ready.map((entry) => <IdentityReviewCard key={entry.id} validation={entry} updating={false} onReview={review} />)}</div></section>}
  </section>;
}

function IdentityReviewCard({ validation, updating, onReview }: { validation: IdentityReview; updating: boolean; onReview: (validation: IdentityReview, status: "ready" | "blocked") => void }) {
  const delivered = validation.orders.some((order) => order.status === "delivered");
  const ReadyIcon = validation.status === "ready" ? BadgeCheck : validation.status === "blocked" ? CircleAlert : validation.giftable_at ? Clock3 : ScanLine;
  return <article className={`identity-review-card status-${validation.status}`}>
    <header><span className="identity-review-icon"><ReadyIcon aria-hidden="true" size={18} /></span><div><span className="order-status-pill">{statusText[validation.status]}</span><h3>{validation.display_name}</h3><p>{validation.platform} · {validation.submitted_id}</p></div></header>
    <dl><div><dt>ID de entrega</dt><dd>{validation.epic_account_id}</dd></div><div><dt>Solicitado</dt><dd>{new Date(validation.created_at).toLocaleString("es-MX")}</dd></div>{validation.giftable_at && <div><dt>48 horas</dt><dd>{new Date(validation.giftable_at).toLocaleString("es-MX")}</dd></div>}<div><dt>Pedidos</dt><dd>{validation.orders.length} {delivered ? "· ya recibió entrega" : ""}</dd></div></dl>
    {validation.review_note && <p className="identity-review-note">{validation.review_note}</p>}
    {validation.status !== "ready" && <div className="identity-review-actions"><button className="primary-button" disabled={updating} onClick={() => onReview(validation, "ready")}>{updating ? "Guardando…" : "Aprobar ID"}</button><button className="danger" disabled={updating} onClick={() => onReview(validation, "blocked")}>Bloquear</button></div>}
    {validation.status === "ready" && <p className="identity-approved-copy"><BadgeCheck aria-hidden="true" size={15} />ID validado{validation.reviewed_at ? ` · ${new Date(validation.reviewed_at).toLocaleDateString("es-MX")}` : ""}</p>}
  </article>;
}
