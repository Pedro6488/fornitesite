"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCommerceState, type IdentityPlatform } from "./commerce-state-provider";

const statusCopy = {
  pending_friendship: "Acepta la solicitud de amistad en Fortnite.",
  waiting: "La amistad está activa; espera a que se cumplan las 48 horas.",
  ready: "ID confirmado y listo para recibir objetos.",
  blocked: "Este ID no se puede usar para una entrega."
} as const;

export function IdentitySheet() {
  const commerce = useCommerceState();
  const [displayName, setDisplayName] = useState("");
  const [platform, setPlatform] = useState<IdentityPlatform>("epic");
  const [message, setMessage] = useState<string | null>(null);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!commerce.identityOpen) return;
    const previous = document.body.style.overflow;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") commerce.closeIdentity();
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]')];
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeys);
    const frame = window.requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>("input, button")?.focus());
    return () => { document.body.style.overflow = previous; window.cancelAnimationFrame(frame); window.removeEventListener("keydown", handleKeys); trigger?.focus(); };
  }, [commerce.identityOpen, commerce.closeIdentity]);

  if (!commerce.identityOpen) return null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(await commerce.validateIdentity(displayName, platform));
  }
  async function addFriend() { setMessage(await commerce.requestFriendship()); }

  return <div className="identity-layer" role="dialog" aria-modal="true" aria-labelledby="identity-title">
    <button className="identity-backdrop" aria-label="Cerrar validación" onClick={commerce.closeIdentity} />
    <section className="identity-sheet" ref={sheetRef}>
      <div className="sheet-handle" aria-hidden="true" />
      <header className="identity-heading"><div><p className="eyebrow">TU LLAVE DE COMPRA</p><h2 id="identity-title">Valida tu ID</h2></div><button type="button" onClick={commerce.closeIdentity} aria-label="Cerrar">×</button></header>
      {commerce.validation ? <div className={`identity-result identity-${commerce.validation.status}`} aria-live="polite">
        <span>{commerce.validation.status === "ready" ? "✓" : "◎"}</span>
        <div><strong>{commerce.validation.display_name}</strong><small>{statusCopy[commerce.validation.status]}</small>{commerce.validation.giftable_at && <small>Disponible aproximadamente: {new Date(commerce.validation.giftable_at).toLocaleString("es-MX")}</small>}</div>
      </div> : <p className="sheet-description">Confirma que el usuario existe y que ya puede recibir regalos. Sin un ID listo no se crea ningún pedido.</p>}
      <form className="identity-form" onSubmit={submit}>
        <label>ID o gamertag<input required minLength={3} maxLength={32} autoComplete="off" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Tu usuario en Fortnite" /></label>
        <label>Plataforma<select value={platform} onChange={(event) => setPlatform(event.target.value as IdentityPlatform)}><option value="epic">Epic Games</option><option value="xbl">Xbox</option><option value="psn">PlayStation</option><option value="nintendo">Nintendo Switch</option></select></label>
        <button className="primary-button" disabled={commerce.syncing}>{commerce.syncing ? "Validando…" : commerce.validation ? "Validar otro ID" : "Validar ID"}</button>
      </form>
      {commerce.validation?.status === "pending_friendship" && <button className="secondary-button" disabled={commerce.syncing} onClick={addFriend}>Enviar solicitud de amistad</button>}
      {commerce.validation?.status === "ready" && <button className="primary-button" onClick={commerce.closeIdentity}>Continuar comprando</button>}
      {message && <p className="notice error" role="alert">{message}</p>}
    </section>
  </div>;
}
