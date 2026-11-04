"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * Next.js solo sube la página si la ruta nueva queda fuera de la vista, y una pantalla de carga
 * siempre queda visible: al llegar el contenido real se conservaba el scroll anterior. Tampoco
 * encuentra un `#ancla` que todavía no existe. Aquí se resuelven ambos casos sin tocar "atrás",
 * donde el navegador debe devolver a la persona al punto donde estaba.
 */
let returningThroughHistory = false;
let anchorPending = false;

/** Va en el layout: tiene que estar escuchando antes de la primera navegación. */
export function RouteScrollTracker() {
  useEffect(() => {
    const markHistory = () => { returningThroughHistory = true; };
    const markNewNavigation = () => { returningThroughHistory = false; };
    window.addEventListener("popstate", markHistory);
    document.addEventListener("click", markNewNavigation, true);
    return () => {
      window.removeEventListener("popstate", markHistory);
      document.removeEventListener("click", markNewNavigation, true);
    };
  }, []);
  return null;
}

/** Va en las pantallas de carga. */
export function ScrollToTopOnLoading() {
  useLayoutEffect(() => {
    if (returningThroughHistory) return;
    if (window.location.hash) anchorPending = true;
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  return null;
}

/** Va en las páginas con ancla y pantalla de carga: lleva al destino cuando ya existe. */
export function ScrollToPendingAnchor() {
  useLayoutEffect(() => {
    if (!anchorPending) return;
    anchorPending = false;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "instant" });
  }, []);
  return null;
}
