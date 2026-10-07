"use client";

import { useCommerceState } from "./commerce-state-provider";
import { BadgeCheck, Clock3, ScanLine } from "lucide-react";

export function IdentityNavButton() {
  const commerce = useCommerceState();
  const manualReview = commerce.validation?.status === "manual_review";
  const waiting = commerce.validation?.status === "waiting";
  const ready = commerce.validation?.status === "ready";
  return <button type="button" className={`identity-nav-button ${ready ? "ready" : waiting ? "waiting" : manualReview ? "manual" : ""}`} onClick={commerce.openIdentity}>
    {ready ? <BadgeCheck aria-hidden="true" size={17} /> : waiting ? <Clock3 aria-hidden="true" size={17} /> : <ScanLine aria-hidden="true" size={17} />}<span>{ready ? "ID validado" : waiting ? "ID en espera" : manualReview ? "ID en revisión" : "Validar ID"}</span>
  </button>;
}
