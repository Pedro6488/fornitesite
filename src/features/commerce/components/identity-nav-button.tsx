"use client";

import { useCommerceState } from "./commerce-state-provider";
import { BadgeCheck, ScanLine } from "lucide-react";

export function IdentityNavButton() {
  const commerce = useCommerceState();
  const manualReview = commerce.validation?.status === "manual_review";
  const ready = commerce.validation?.status === "ready";
  return <button type="button" className={`identity-nav-button ${ready ? "ready" : manualReview ? "manual" : ""}`} onClick={commerce.openIdentity}>
    {ready ? <BadgeCheck aria-hidden="true" size={17} /> : <ScanLine aria-hidden="true" size={17} />}<span>{ready ? "ID listo" : manualReview ? "ID en revisión" : "Validar ID"}</span>
  </button>;
}
