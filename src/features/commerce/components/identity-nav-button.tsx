"use client";

import { useCommerceState } from "./commerce-state-provider";
import { BadgeCheck, ChevronDown, CircleAlert, Clock3, Plus, ScanLine } from "lucide-react";
import { getIdentityPresentation } from "../application/identity-presentation";

const shortStatus = {
  pending_friendship: "Solicitud pendiente",
  waiting: "En espera",
  ready: "ID listo",
  manual_review: "En revisión",
  blocked: "No disponible",
} as const;

export function IdentityNavButton() {
  const commerce = useCommerceState();
  const presentation = getIdentityPresentation(commerce.validation);
  const StatusIcon = presentation.tone === "success" ? BadgeCheck
    : presentation.tone === "danger" ? CircleAlert
      : presentation.tone === "warning" ? Clock3
        : ScanLine;

  if (!commerce.validation) return <button type="button" className={`identity-nav-button ${presentation.tone}`} onClick={commerce.openIdentity}>
    <StatusIcon aria-hidden="true" size={17} /><span>{presentation.actionLabel}</span>
  </button>;

  return <div className={`identity-nav-selector ${presentation.tone}`} title={presentation.description}>
    <StatusIcon className="identity-nav-status-icon" aria-hidden="true" size={17} />
    <label>
      <span>{shortStatus[commerce.validation.status]}</span>
      <span className="identity-nav-select-wrap">
        <select
          aria-label={`ID de entrega activo. ${shortStatus[commerce.validation.status]}`}
          value={commerce.validation.id}
          disabled={commerce.syncing}
          onChange={(event) => void commerce.selectValidation(event.target.value)}
        >
          {commerce.validations.map((validation) => <option key={validation.id} value={validation.id}>
            {validation.display_name} · {shortStatus[validation.status]}
          </option>)}
        </select>
        <ChevronDown aria-hidden="true" size={14} />
      </span>
    </label>
    <button type="button" className="identity-nav-manage" onClick={commerce.openIdentity} aria-label="Administrar IDs de entrega" title="Administrar IDs de entrega">
      <Plus aria-hidden="true" size={16} />
    </button>
  </div>;
}
