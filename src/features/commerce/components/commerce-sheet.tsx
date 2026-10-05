"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function CommerceSheet({ open, onClose, titleId, eyebrow, title, description, className = "", children }: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeys);
    const frame = window.requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>("input, button")?.focus());
    return () => {
      document.body.style.overflow = previous;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeys);
      trigger?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;
  return <div className="identity-layer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <button className="identity-backdrop" aria-label={`Cerrar ${title.toLocaleLowerCase("es-MX")}`} onClick={onClose} />
    <section className={`identity-sheet commerce-sheet ${className}`.trim()} ref={sheetRef}>
      <div className="sheet-handle" aria-hidden="true" />
      <header className="identity-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" onClick={onClose} aria-label="Cerrar"><X aria-hidden="true" size={19} /></button></header>
      {children}
    </section>
  </div>;
}
