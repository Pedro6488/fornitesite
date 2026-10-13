"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type BackButtonProps = Readonly<{
  fallbackHref?: string;
  label?: string;
  preferFallback?: boolean;
}>;

export function BackButton({
  fallbackHref = "/#catalogo",
  label = "Volver al catálogo",
  preferFallback = false
}: BackButtonProps) {
  const router = useRouter();

  function navigateBack() {
    if (preferFallback) {
      router.push(fallbackHref);
      return;
    }
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
      <span aria-hidden="true"><ArrowLeft size={15} strokeWidth={2.4} /></span>
      {label}
    </button>
  );
}
