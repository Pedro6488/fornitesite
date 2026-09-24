"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = Readonly<{
  fallbackHref?: string;
  label?: string;
}>;

export function BackButton({
  fallbackHref = "/#catalogo",
  label = "Volver al catálogo"
}: BackButtonProps) {
  const router = useRouter();

  function navigateBack() {
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      if (referrer?.origin === window.location.origin) {
        router.back();
        return;
      }
    } catch {
      // A malformed referrer should never block the safe fallback.
    }

    router.push(fallbackHref);
  }

  return (
    <button className="back-button" type="button" onClick={navigateBack}>
      <span aria-hidden="true">←</span>
      {label}
    </button>
  );
}
