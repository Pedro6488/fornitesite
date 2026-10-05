"use client";

import { useCommerceState } from "./commerce-state-provider";

export function IdentityNavButton() {
  const commerce = useCommerceState();
  return <button type="button" className={`identity-nav-button ${commerce.validation?.status === "ready" ? "ready" : ""}`} onClick={commerce.openIdentity}>
    <span aria-hidden="true" />{commerce.validation?.status === "ready" ? commerce.validation.display_name : "Validar ID"}
  </button>;
}
