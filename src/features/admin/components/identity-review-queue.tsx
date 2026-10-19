"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, Clock3, RefreshCw, ScanLine } from "lucide-react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import { AdminActionModal } from "@/shared/components/admin-action-modal";
import { isIdentityReviewPending } from "@/features/commerce/application/identity-review-state";

type ReviewStatus = "pending_friendship" | "waiting" | "ready" | "manual_review" | "blocked";
type ReviewAction = "waiting" | "ready" | "blocked";

type IdentityReview = {
  id: string; platform: string; submitted_id: string; epic_account_id: string; display_name: string;
  status: ReviewStatus; giftable_at: string | null; last_checked_at: string; created_at: string;
  reviewed_at: string | null; review_note: string | null; user_id: string | null;
  orders: { id: string; status: string; created_at: string; item_name: string }[];
  session_count: number;
};

const statusText: Record<ReviewStatus, string> = {
  pending_friendship: "Solicitud pendiente", waiting: "Espera de 48 horas", ready: "ID listo",
  manual_review: "Por revisar", blocked: "Bloqueado",
};

function waitHasExpired(validation: IdentityReview): boolean {
  return validation.status === "waiting" && Boolean(validation.giftable_at) && new Date(validation.giftable_at!).getTime() <= Date.now();
}

function remainingTime(date: string): string {
  const milliseconds = Math.max(0, new Date(date).getTime() - Date.now());
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.ceil((milliseconds % 3_600_000) / 60_000);
  return hours > 0 ? `${hours} h ${minutes} min restantes` : `${minutes} min restantes`;
}

export function IdentityReviewQueue() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [validations, setValidations] = useState<IdentityReview[]>([]);
  const [message, setMessage] = useState("Cargando IDs…");
  const [updating, setUpdating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingReview, setPendingReview] = useState<{ validation: IdentityReview; status: ReviewAction } | null>(null);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session) throw new Error("La sesión de administrador expiró.");
    const response = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "No fue posible completar la revisión.");
    return body;
  }, [supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("Cargando IDs…");
    try {
      const body = await request("/api/admin/validations");
      setValidations(body.validations ?? []);
      setMessage(body.validations?.length ? "" : "No hay IDs para revisar todavía.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible cargar los IDs.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function review(validation: IdentityReview, status: ReviewAction, notes: string) {
    setUpdating(validation.id);
    try {
      await request(`/api/admin/validations/${validation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: notes || undefined }),
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible guardar la revisión.");
    } finally {
      setUpdating(null);
    }
  }

  const pending = validations.filter((entry) => isIdentityReviewPending(entry.status));
  const ready = validations.filter((entry) => entry.status === "ready");
  const blocked = validations.filter((entry) => entry.status === "blocked");
  const override = pendingReview?.status === "ready" && !waitHasExpired(pendingReview.validation);
  const modal = pendingReview ? override ? {
    title: "Autorizar ID antes de concluir las 48 horas",
    description: "Esta acción permitirá comprar inmediatamente con este ID. Quedará registrada con tu usuario y el motivo indicado.",
    confirmLabel: "Autorizar ID",
    notesLabel: "Motivo de la autorización",
    notesPlaceholder: "Explica el motivo operativo de esta excepción.",
    notesRequired: true,
    notesMinLength: 10,
    tone: "warning" as const,
  } : pendingReview.status === "waiting" ? {
    title: "Enviar solicitud e iniciar 48 horas",
    description: `Confirma que enviaste la solicitud a ${pendingReview.validation.display_name}. La espera iniciará ahora y no se reiniciará si repites la operación.`,
    confirmLabel: "Enviar solicitud",
    notesLabel: "Nota interna (opcional)",
    notesPlaceholder: "Agrega una nota para el equipo si es necesaria.",
    notesRequired: false,
    notesMinLength: 3,
    tone: "primary" as const,
  } : pendingReview.status === "ready" ? {
    title: "Concluir espera de 48 horas",
    description: `${pendingReview.validation.display_name} ya cumplió la espera y quedará listo para comprar.`,
    confirmLabel: "Marcar como listo",
    notesLabel: "Nota interna (opcional)",
    notesPlaceholder: "Agrega una nota para el equipo si es necesaria.",
    notesRequired: false,
    notesMinLength: 3,
    tone: "primary" as const,
  } : {
    title: "Bloquear ID de entrega",
    description: `Este ID no podrá utilizarse para entregas: ${pendingReview.validation.display_name}.`,
    confirmLabel: "Bloquear ID",
    notesLabel: "Motivo del bloqueo",
    notesPlaceholder: "Explica por qué este ID no puede utilizarse.",
    notesRequired: true,
    notesMinLength: 3,
    tone: "danger" as const,
  } : null;

  return <section className="identity-review-queue">
    <header className="identity-review-heading">
      <div><p className="eyebrow">IDENTIDADES DE ENTREGA</p><h2>Revisión de IDs</h2><p>La espera normal dura 48 horas. Las autorizaciones anticipadas requieren un motivo y quedan auditadas.</p></div>
      <button type="button" className="identity-review-refresh" disabled={loading || Boolean(updating)} onClick={() => void load()}><RefreshCw aria-hidden="true" size={16} />{loading ? "Actualizando…" : "Actualizar"}</button>
    </header>
    {message && <p className="notice">{message}</p>}
    {pending.length > 0 && <div className="identity-review-grid">{pending.map((entry) => <IdentityReviewCard key={entry.id} validation={entry} updating={updating === entry.id} onReview={(validation, status) => setPendingReview({ validation, status })} />)}</div>}
    {ready.length > 0 && <section className="identity-approved-list"><p className="eyebrow">LISTOS</p><div>{ready.map((entry) => <IdentityReviewCard key={entry.id} validation={entry} updating={updating === entry.id} onReview={(validation, status) => setPendingReview({ validation, status })} />)}</div></section>}
    {blocked.length > 0 && <section className="identity-approved-list"><p className="eyebrow">BLOQUEADOS</p><div>{blocked.map((entry) => <IdentityReviewCard key={entry.id} validation={entry} updating={false} onReview={(validation, status) => setPendingReview({ validation, status })} />)}</div></section>}
    <AdminActionModal
      open={Boolean(pendingReview && modal)} onClose={() => setPendingReview(null)}
      title={modal?.title ?? ""} description={modal?.description ?? ""} confirmLabel={modal?.confirmLabel ?? "Confirmar"}
      tone={modal?.tone} notesLabel={modal?.notesLabel} notesPlaceholder={modal?.notesPlaceholder}
      notesRequired={modal?.notesRequired} notesMinLength={modal?.notesMinLength} busy={Boolean(updating)}
      onConfirm={(notes) => { if (!pendingReview) return; const next = pendingReview; setPendingReview(null); void review(next.validation, next.status, notes); }}
    />
  </section>;
}

function IdentityReviewCard({ validation, updating, onReview }: { validation: IdentityReview; updating: boolean; onReview: (validation: IdentityReview, status: ReviewAction) => void }) {
  const delivered = validation.orders.some((order) => order.status === "delivered");
  const expired = waitHasExpired(validation);
  const ReadyIcon = validation.status === "ready" ? BadgeCheck : validation.status === "blocked" ? CircleAlert : validation.giftable_at ? Clock3 : ScanLine;
  return <article className={`identity-review-card status-${validation.status}`}>
    <header><span className="identity-review-icon"><ReadyIcon aria-hidden="true" size={18} /></span><div><span className="order-status-pill">{statusText[validation.status]}</span><h3>{validation.display_name}</h3><p>{validation.platform} · {validation.submitted_id}</p></div></header>
    <dl>
      <div><dt>ID de entrega</dt><dd>{validation.epic_account_id}</dd></div>
      <div><dt>Solicitado</dt><dd>{new Date(validation.created_at).toLocaleString("es-MX")}</dd></div>
      {validation.giftable_at && <div><dt>Disponible</dt><dd>{new Date(validation.giftable_at).toLocaleString("es-MX")} · {expired ? "espera cumplida" : remainingTime(validation.giftable_at)}</dd></div>}
      <div><dt>Pedidos</dt><dd>{validation.orders.length} {delivered ? "· ya recibió entrega" : ""}</dd></div>
      {validation.session_count > 1 && <div><dt>Registrado en</dt><dd>{validation.session_count} sesiones · la decisión aplica a todas</dd></div>}
    </dl>
    {validation.review_note && <p className="identity-review-note">{validation.review_note}</p>}
    {isIdentityReviewPending(validation.status) && <div className="identity-review-actions">
      {(validation.status === "manual_review" || validation.status === "pending_friendship") && <button className="identity-review-action send" disabled={updating} onClick={() => onReview(validation, "waiting")}>{updating ? "Guardando…" : "Enviar solicitud e iniciar 48 h"}</button>}
      {validation.status === "manual_review" && <button className="identity-review-action override" disabled={updating} onClick={() => onReview(validation, "ready")}>{updating ? "Guardando…" : "Autorizar excepción"}</button>}
      {validation.status === "waiting" && <button className={expired ? "identity-review-action approve" : "identity-review-action override"} disabled={updating} onClick={() => onReview(validation, "ready")}>{updating ? "Guardando…" : expired ? "Marcar como listo" : "Autorizar antes de 48 h"}</button>}
      <button className="identity-review-action danger" disabled={updating} onClick={() => onReview(validation, "blocked")}>{updating ? "Guardando…" : "Bloquear"}</button>
    </div>}
    {validation.status === "ready" && <><p className="identity-approved-copy"><BadgeCheck aria-hidden="true" size={15} />ID listo{validation.reviewed_at ? ` · ${new Date(validation.reviewed_at).toLocaleDateString("es-MX")}` : ""}</p><div className="identity-review-actions"><button className="identity-review-action danger" disabled={updating} onClick={() => onReview(validation, "blocked")}>Bloquear</button></div></>}
  </article>;
}
