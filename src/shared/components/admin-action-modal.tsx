"use client";

import { useEffect, useState } from "react";
import { CommerceSheet } from "@/features/commerce/components/commerce-sheet";

export function AdminActionModal({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  notesLabel,
  notesPlaceholder,
  notesRequired = false,
  notesMinLength = 3,
  busy = false,
  onClose,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "warning" | "danger";
  notesLabel?: string;
  notesPlaceholder?: string;
  notesRequired?: boolean;
  notesMinLength?: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => setNotes(""), 0);
    return () => window.clearTimeout(timeout);
  }, [open]);
  const valid = !notesRequired || notes.trim().length >= notesMinLength;
  return <CommerceSheet open={open} onClose={onClose} titleId="admin-action-modal-title" eyebrow="CONFIRMAR OPERACIÓN" title={title} description={description} className="admin-action-sheet">
    <form className="admin-action-form" onSubmit={(event) => { event.preventDefault(); if (valid && !busy) onConfirm(notes.trim()); }}>
      {notesLabel && <label>{notesLabel}{notesRequired && <span> (requerido, mínimo {notesMinLength} caracteres)</span>}<textarea autoFocus required={notesRequired} minLength={notesRequired ? notesMinLength : undefined} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={notesPlaceholder} /></label>}
      <div><button type="button" className="admin-action-cancel" disabled={busy} onClick={onClose}>Volver</button><button className={`admin-action-confirm${tone === "primary" ? "" : ` ${tone}`}`} disabled={!valid || busy}>{busy ? "Guardando…" : confirmLabel}</button></div>
    </form>
  </CommerceSheet>;
}
