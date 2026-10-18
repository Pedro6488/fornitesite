"use client";

import { useCommerceState } from "./commerce-state-provider";
import { BadgeCheck, ChevronDown, CircleAlert, Clock3, ScanLine } from "lucide-react";
import { getIdentityPresentation } from "../application/identity-presentation";

const shortStatus = {
  pending_friendship: "Solicitud pendiente",
  waiting: "48 h",
  ready: "Listo",
  manual_review: "En revisión",
  blocked: "Bloqueado",
} as const;

const MANAGE_IDENTITIES_VALUE = "__manage_identities__";

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

  return <div className={`identity-nav-selector ${presentation.tone} ${commerce.syncing ? "syncing" : ""}`} title={presentation.description}>
    <StatusIcon className="identity-nav-status-icon" aria-hidden="true" size={17} />
    <span className="identity-nav-current">
      <small>ENTREGA A <em>{shortStatus[commerce.validation.status]}</em></small>
      <strong>{commerce.validation.display_name}</strong>
    </span>
    <ChevronDown className="identity-nav-chevron" aria-hidden="true" size={15} />
    <select
      className="identity-nav-native-select"
      aria-label={`ID de entrega activo: ${commerce.validation.display_name}. ${shortStatus[commerce.validation.status]}`}
      value={commerce.validation.id}
      disabled={commerce.syncing}
      onChange={(event) => {
        if (event.target.value === MANAGE_IDENTITIES_VALUE) {
          commerce.openIdentity();
          return;
        }
        void commerce.selectValidation(event.target.value);
      }}
    >
      {commerce.validations.map((validation) => <option key={validation.id} value={validation.id}>
        {validation.display_name} — {shortStatus[validation.status]}
      </option>)}
      <option value={MANAGE_IDENTITIES_VALUE}>＋ Agregar o administrar IDs</option>
    </select>
  </div>;
}
