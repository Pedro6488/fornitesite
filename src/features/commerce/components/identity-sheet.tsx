"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, ChevronDown, CircleAlert, Clock3, Plus, ScanLine } from "lucide-react";
import { useCommerceState, type IdentityPlatform } from "./commerce-state-provider";
import { CommerceSheet } from "./commerce-sheet";
import { getIdentityPresentation } from "../application/identity-presentation";

const platformLabel = { epic: "Epic Games", xbl: "Xbox", psn: "PlayStation", nintendo: "Nintendo Switch" } as const;

function timeRemaining(date: string, now: number) {
  const remaining = new Date(date).getTime() - now;
  if (remaining <= 0) return "La espera terminó. Actualiza el estado.";
  const minutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  return `Faltan ${hours} h ${minutes % 60} min para quedar listo.`;
}

export function IdentitySheet() {
  const commerce = useCommerceState();
  const [displayName, setDisplayName] = useState("");
  const [platform, setPlatform] = useState<IdentityPlatform>("epic");
  const [message, setMessage] = useState<string | null>(null);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const presentation = getIdentityPresentation(commerce.validation);
  const canContinue = presentation.canQuote;

  useEffect(() => {
    if (!commerce.identityOpen || commerce.validation?.status !== "waiting") return;
    const initialUpdate = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { window.clearTimeout(initialUpdate); window.clearInterval(interval); };
  }, [commerce.identityOpen, commerce.validation?.status]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextMessage = await commerce.validateIdentity(displayName, platform);
    setMessage(nextMessage);
    if (!nextMessage) setEditingIdentity(false);
  }
  function addAnotherIdentity() {
    setDisplayName("");
    setPlatform("epic");
    setMessage(null);
    setEditingIdentity(true);
  }

  return <CommerceSheet open={commerce.identityOpen} onClose={commerce.closeIdentity} titleId="identity-title" eyebrow="IDENTIDAD DE ENTREGA" title="Elige o valida tu ID" description="Tu ID se guarda en esta sesión. Puedes tener más de uno y seleccionar cuál recibirá esta compra.">
      {commerce.validations.length > 0 && <div className="identity-saved" aria-label="IDs guardados">
        <div><strong>Tus IDs</strong><small>Selecciona el que usarás ahora</small></div>
        <div className="identity-saved-list">
          {commerce.validations.map((entry) => <button key={entry.id} type="button" aria-pressed={entry.id === commerce.validation?.id} className={`${entry.id === commerce.validation?.id ? "active " : ""}identity-status-${entry.status}`} disabled={commerce.syncing} onClick={() => void commerce.selectValidation(entry.id)}>
            {entry.status === "ready" ? <BadgeCheck aria-hidden="true" size={16} /> : entry.status === "blocked" ? <CircleAlert aria-hidden="true" size={16} /> : entry.status === "waiting" || entry.status === "manual_review" || entry.status === "pending_friendship" ? <Clock3 aria-hidden="true" size={16} /> : <ScanLine aria-hidden="true" size={16} />}<span><b>{entry.display_name}</b><small>{platformLabel[entry.platform]} · {getIdentityPresentation(entry).label}</small></span>
          </button>)}
        </div>
      </div>}
      {commerce.validation ? <div className={`identity-result identity-${commerce.validation.status}`} aria-live="polite">
        <span>{commerce.validation.status === "ready" ? <BadgeCheck aria-hidden="true" size={19} /> : commerce.validation.status === "waiting" ? <Clock3 aria-hidden="true" size={19} /> : commerce.validation.status === "blocked" ? <CircleAlert aria-hidden="true" size={19} /> : <ScanLine aria-hidden="true" size={19} />}</span>
        <div><strong>{commerce.validation.display_name}</strong><small>{presentation.label}. {presentation.description}</small>{commerce.validation.status === "waiting" && commerce.validation.giftable_at && <small className="identity-countdown">{timeRemaining(commerce.validation.giftable_at, now)}</small>}</div>
      </div> : <p className="sheet-description">Agrega el ID que recibirá los objetos. Por ahora nuestro equipo lo revisará manualmente antes de solicitar tu pago.</p>}
      {(!commerce.validation || editingIdentity) && <form className="identity-form" onSubmit={submit}>
        <div className="identity-form-title"><span><Plus aria-hidden="true" size={15} />Agregar o actualizar</span><small>Lo guardamos para que el equipo confirme la entrega.</small></div>
        <label>ID o gamertag<input required minLength={3} maxLength={32} autoComplete="off" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Tu usuario en Fortnite" /></label>
        <label>Plataforma<span className="select-control"><select value={platform} onChange={(event) => setPlatform(event.target.value as IdentityPlatform)}><option value="epic">Epic Games</option><option value="xbl">Xbox</option><option value="psn">PlayStation</option><option value="nintendo">Nintendo Switch</option></select><ChevronDown aria-hidden="true" size={17} /></span></label>
        <button className="primary-button" disabled={commerce.syncing}>{commerce.syncing ? "Guardando…" : "Guardar nuevo ID"}</button>
      </form>}
      {commerce.validation && !editingIdentity && <button type="button" className="identity-add-another" onClick={addAnotherIdentity}><Plus aria-hidden="true" size={15} />Agregar otro ID</button>}
      {commerce.validation && <button type="button" className="secondary-button" disabled={commerce.syncing} onClick={() => void commerce.refresh()}>Actualizar estado</button>}
      {canContinue && <button className="primary-button identity-continue" onClick={commerce.closeIdentity}>Usar este ID y continuar</button>}
      {message && <p className="notice error" role="alert">{message}</p>}
  </CommerceSheet>;
}
