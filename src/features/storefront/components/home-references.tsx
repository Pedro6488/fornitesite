"use client";

import { ArrowLeft, ArrowRight, BadgeCheck, MessageSquareQuote, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ReferenceGallery } from "@/features/community/components/reference-gallery";
import type { getPublicDeliveryReferences } from "@/features/community/server/get-community";
import styles from "./home-references.module.css";

type Reference = Awaited<ReturnType<typeof getPublicDeliveryReferences>>[number];

export function HomeReferences({ references, unavailable }: { references: readonly Reference[]; unavailable: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const select = (index: number) => {
    setActiveIndex(index);
    const container = track.current;
    const card = container?.children[index] as HTMLElement | undefined;
    if (container && card) container.scrollTo?.({ left: card.offsetLeft - container.offsetLeft, behavior: reducedMotion() ? "instant" : "smooth" });
  };
  useEffect(() => {
    if (paused || references.length < 2 || reducedMotion()) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && !track.current?.querySelector("dialog[open]")) {
        const next = (activeIndex + 1) % references.length;
        setActiveIndex(next);
        const container = track.current;
        const card = container?.children[next] as HTMLElement | undefined;
        if (container && card) container.scrollTo?.({ left: card.offsetLeft - container.offsetLeft, behavior: "smooth" });
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeIndex, paused, references.length]);
  return <section id="referencias" className={styles.section} aria-labelledby="home-references-title">
    <header className={styles.header}>
      <div><p>ENTREGAS CONFIRMADAS</p><h2 id="home-references-title">LA CONFIANZA SE GANA.</h2></div>
      <Link href="/referencias">Ver todas las referencias <ArrowRight size={18} /></Link>
    </header>
    {references.length > 0 ? <div className={styles.carousel} aria-roledescription="carrusel" aria-label="Referencias de clientes">
      <div className={styles.track} ref={track} onScroll={() => {
        const container = track.current;
        if (!container) return;
        const cards = Array.from(container.children) as HTMLElement[];
        const closest = cards.reduce((best, card, index) => Math.abs(card.offsetLeft - container.offsetLeft - container.scrollLeft) < Math.abs(cards[best].offsetLeft - container.offsetLeft - container.scrollLeft) ? index : best, 0);
        setActiveIndex(closest);
      }}>
      {references.map((reference, index) => <article className={styles.card} key={`${reference.createdAt}-${index}`} aria-label={`Referencia ${index + 1} de ${references.length}`}>
        {reference.imageUrls.length > 0 ? <ReferenceGallery images={reference.imageUrls} owner={reference.recipientName} /> : <div className={styles.placeholder}><MessageSquareQuote size={72} /></div>}
        <div className={styles.body}>
          <span className={styles.verified}><BadgeCheck size={18} /> Entrega confirmada</span>
          {reference.comment && <blockquote>“{reference.comment}”</blockquote>}
          <ul>{reference.items.map((item, index) => <li key={index}>{item.quantity} × {item.item_name}</li>)}</ul>
          <strong>{reference.recipientName}</strong>
          <time dateTime={reference.createdAt}>{new Date(reference.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" })}</time>
        </div>
      </article>)}
      </div>
      {references.length > 1 && <div className={styles.controls}>
        <button type="button" aria-label="Referencia anterior" onClick={() => select((activeIndex - 1 + references.length) % references.length)}><ArrowLeft size={20} /></button>
        <span>{activeIndex + 1} / {references.length}</span>
        <button type="button" aria-label="Siguiente referencia" onClick={() => select((activeIndex + 1) % references.length)}><ArrowRight size={20} /></button>
        <button type="button" aria-label={paused ? "Reanudar carrusel" : "Pausar carrusel"} onClick={() => setPaused(!paused)}>{paused ? <Play size={18} /> : <Pause size={18} />}</button>
      </div>}
    </div> : <div className={styles.empty}><MessageSquareQuote size={36} /><h3>{unavailable ? "No pudimos cargar las referencias" : "Pronto verás aquí las referencias"}</h3><p>{unavailable ? "Intenta de nuevo en unos momentos." : "Los comentarios y evidencias de entregas confirmadas aparecerán en este espacio."}</p></div>}
  </section>;
}
