"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ProductRail({ children, label }: { children: ReactNode; label: string }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ start: true, end: false });

  const syncPosition = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setPosition({
      start: rail.scrollLeft <= 2,
      end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    syncPosition();
    const observer = new ResizeObserver(syncPosition);
    observer.observe(rail);
    rail.addEventListener("scroll", syncPosition, { passive: true });
    return () => {
      observer.disconnect();
      rail.removeEventListener("scroll", syncPosition);
    };
  }, [syncPosition]);

  function move(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(240, rail.clientWidth * .82), behavior: "smooth" });
  }

  return <div className="product-rail-shell">
    <div className="detail-card-rail" ref={railRef}>{children}</div>
    <div className="product-rail-controls" aria-label={`Navegar ${label}`}>
      <button type="button" disabled={position.start} onClick={() => move(-1)} aria-label={`Ver anteriores en ${label}`}><ChevronLeft aria-hidden="true" size={18} /></button>
      <button type="button" disabled={position.end} onClick={() => move(1)} aria-label={`Ver siguientes en ${label}`}><ChevronRight aria-hidden="true" size={18} /></button>
    </div>
  </div>;
}
