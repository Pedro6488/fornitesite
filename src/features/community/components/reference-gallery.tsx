/* eslint-disable @next/next/no-img-element -- Son URLs firmadas que caducan en minutos: no deben pasar por el optimizador. */
"use client";

import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

/** La evidencia se muestra completa, sin recortes, y se puede ampliar sin salir de la página. */
export function ReferenceGallery({ images, owner }: { images: readonly string[]; owner: string }) {
  const [active, setActive] = useState(0);
  const viewer = useRef<HTMLDialogElement>(null);
  const current = images[active] ?? images[0];
  const several = images.length > 1;
  const alt = (index: number) => `Evidencia ${index + 1} de ${owner}`;

  function move(step: number) {
    setActive((index) => (index + step + images.length) % images.length);
  }

  function closeOnEmptyArea(event: MouseEvent<HTMLDialogElement>) {
    if (!(event.target as HTMLElement).closest("img, button")) viewer.current?.close();
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLDialogElement>) {
    if (!several) return;
    if (event.key === "ArrowRight") move(1);
    if (event.key === "ArrowLeft") move(-1);
  }

  if (!current) return null;

  return <div className="reference-gallery">
    <button type="button" className="reference-stage" onClick={() => viewer.current?.showModal?.()} aria-label={`Ampliar ${alt(active).toLocaleLowerCase("es-MX")}`}>
      <img className="reference-stage-glow" src={current} alt="" aria-hidden="true" loading="lazy" />
      <img className="reference-stage-image" src={current} alt={alt(active)} loading="lazy" />
      <span className="reference-expand" aria-hidden="true"><Maximize2 size={14} />Ver completa</span>
    </button>
    {several && <div className="reference-thumbs">
      {images.map((image, index) => <button type="button" key={image} aria-pressed={index === active} aria-label={`Ver evidencia ${index + 1} de ${images.length}`} onClick={() => setActive(index)}>
        <img src={image} alt="" loading="lazy" />
      </button>)}
    </div>}
    <dialog className="reference-viewer" ref={viewer} aria-label={`Evidencias de ${owner}`} onClick={closeOnEmptyArea} onKeyDown={moveWithKeyboard}>
      <header>
        <span>{owner}{several ? ` · ${active + 1} de ${images.length}` : ""}</span>
        <button type="button" onClick={() => viewer.current?.close()} aria-label="Cerrar evidencia"><X aria-hidden="true" size={20} /></button>
      </header>
      <div className="reference-viewer-image">
        {several && <button type="button" onClick={() => move(-1)} aria-label="Evidencia anterior"><ChevronLeft aria-hidden="true" size={24} /></button>}
        <img src={current} alt={alt(active)} />
        {several && <button type="button" onClick={() => move(1)} aria-label="Evidencia siguiente"><ChevronRight aria-hidden="true" size={24} /></button>}
      </div>
    </dialog>
  </div>;
}
