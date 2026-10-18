"use client";

import { useCommerceState } from "./commerce-state-provider";
import { BadgeCheck, CircleAlert, Clock3, ScanLine } from "lucide-react";
import { getIdentityPresentation } from "../application/identity-presentation";

export function IdentityNavButton() {
  const commerce = useCommerceState();
  const presentation = getIdentityPresentation(commerce.validation);
  return <button type="button" className={`identity-nav-button ${presentation.tone}`} onClick={commerce.openIdentity}>
    {presentation.tone === "success" ? <BadgeCheck aria-hidden="true" size={17} /> : presentation.tone === "danger" ? <CircleAlert aria-hidden="true" size={17} /> : presentation.tone === "warning" ? <Clock3 aria-hidden="true" size={17} /> : <ScanLine aria-hidden="true" size={17} />}<span>{presentation.actionLabel}</span>
  </button>;
}
