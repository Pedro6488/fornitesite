"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import styles from "./game-stage.module.css";

const ROTATION_MS = 6_000;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(notify: () => void) {
  const query = window.matchMedia?.(REDUCED_MOTION_QUERY);
  query?.addEventListener("change", notify);
  return () => query?.removeEventListener("change", notify);
}

function prefersReducedMotion() {
  return window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;
}

/**
 * Rota solo mientras nadie interactúa. Elegir una opción la deja fija:
 * quien ya decidió qué ver no debe perderlo por el temporizador.
 */
export function useStageRotation(count: number) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, prefersReducedMotion, () => false);
  const rotating = count > 1 && !pinned && !interacting && !reducedMotion;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) setActiveIndex((current) => (current + 1) % count);
    }, ROTATION_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, activeIndex, count]);

  const select = useCallback((index: number) => {
    setActiveIndex(index);
    setPinned(true);
  }, []);

  return {
    activeIndex,
    rotating,
    select,
    interactionProps: {
      onMouseEnter: () => setInteracting(true),
      onMouseLeave: () => setInteracting(false),
      onFocus: () => setInteracting(true),
      onBlur: () => setInteracting(false)
    }
  };
}

export function GameStageBackdrop({ word }: { word: string }) {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <span className={styles.glow} />
      <span className={styles.slashViolet} />
      <span className={styles.slashLime} />
      <span className={styles.ghost}>{word}</span>
      <span className={styles.floor} />
    </div>
  );
}

export type StageRailOption = Readonly<{
  id: string;
  name: string;
  image: string;
  rarity?: string;
  accent?: string;
}>;

export function StageRail({ options, activeIndex, rotating, label, onSelect }: {
  options: readonly StageRailOption[];
  activeIndex: number;
  rotating: boolean;
  label: string;
  onSelect: (index: number) => void;
}) {
  if (options.length < 2) return null;
  return (
    <div className={styles.rail} role="group" aria-label={label}>
      {options.map((option, index) => (
        <button
          type="button"
          className={styles.thumb}
          key={option.id}
          data-rarity={option.rarity}
          style={option.accent ? { "--rarity": option.accent } as CSSProperties : undefined}
          aria-pressed={index === activeIndex}
          aria-label={`Mostrar ${option.name}`}
          onClick={() => onSelect(index)}
        >
          <span className={styles.thumbArt}>
            <Image src={option.image} alt="" fill sizes="96px" />
            {index === activeIndex && rotating && <i key={activeIndex} className={styles.progress} style={{ animationDuration: `${ROTATION_MS}ms` }} aria-hidden="true" />}
          </span>
        </button>
      ))}
    </div>
  );
}
