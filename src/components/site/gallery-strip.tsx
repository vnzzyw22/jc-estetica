"use client";

import Image from "next/image";
import { useRef } from "react";
import type { GalleryItem } from "@/lib/types";

// Escalas e recuos alternados: a faixa nunca vira uma fileira uniforme.
const FRAMES = [
  { w: "w-[72vw] sm:w-[26rem]", ratio: "3 / 4", offset: "mt-0" },
  { w: "w-[56vw] sm:w-[18rem]", ratio: "1 / 1", offset: "mt-14 sm:mt-24" },
  { w: "w-[78vw] sm:w-[30rem]", ratio: "4 / 5", offset: "mt-6 sm:mt-10" },
  { w: "w-[60vw] sm:w-[22rem]", ratio: "5 / 4", offset: "mt-20 sm:mt-32" },
  { w: "w-[70vw] sm:w-[24rem]", ratio: "3 / 4", offset: "mt-2" },
];

export function GalleryStrip({ items }: { items: GalleryItem[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const placeholders = items.length === 0;
  const slots: Array<{ key: string; real: GalleryItem | null }> = placeholders
    ? Array.from({ length: 3 }, (_, i) => ({ key: `ph-${i}`, real: null }))
    : items.map((it) => ({ key: it.id, real: it }));

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-end gap-6">
        <button type="button" className="link-draw min-h-11 text-[0.95rem]" onClick={() => scrollBy(-1)}>
          Anterior
        </button>
        <button type="button" className="link-draw min-h-11 text-[0.95rem]" onClick={() => scrollBy(1)}>
          Próxima
        </button>
      </div>

      <div
        ref={scroller}
        tabIndex={0}
        role="region"
        aria-label="Galeria de fotos, role para o lado"
        className="no-scrollbar -mr-[var(--spacing-gutter)] flex snap-x snap-mandatory items-start gap-5 overflow-x-auto pb-6 pr-[var(--spacing-gutter)] sm:gap-8"
      >
        {slots.map(({ key, real }, i) => {
          const f = FRAMES[i % FRAMES.length];
          return (
            <figure key={key} className={`${f.w} ${f.offset} shrink-0 snap-start`}>
              <div className="photo-slot" style={{ aspectRatio: f.ratio }}>
                {real ? (
                  <Image src={real.image_url} alt={real.title ?? "Foto da galeria"} fill sizes="(min-width: 640px) 30rem, 78vw" className="object-cover" loading="lazy" />
                ) : (
                  <span data-photo-caption>[Foto real de resultado — enviar pelo painel]</span>
                )}
              </div>
              {real?.title && <figcaption className="t-small mt-3">{real.title}</figcaption>}
            </figure>
          );
        })}
      </div>
    </div>
  );
}
