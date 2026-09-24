"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CATEGORY_LABEL } from "@/lib/format";
import type { GalleryItem } from "@/lib/types";

const RATIOS = ["3 / 4", "1 / 1", "4 / 5", "5 / 4", "3 / 4", "4 / 5"];

/** Galeria editorial: colunas com escalas mistas e filtro por categoria; clique abre a foto grande. */
export function GalleryBrowser({ items }: { items: GalleryItem[] }) {
  const categories = Array.from(new Set(items.map((i) => i.category)));
  const [filter, setFilter] = useState<string>("todas");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const visible = filter === "todas" ? items : items.filter((i) => i.category === filter);
  const current = openIndex !== null ? visible[openIndex] : null;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (current && !el.open) el.showModal();
    if (!current && el.open) el.close();
  }, [current]);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : (i + 1) % visible.length));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : (i - 1 + visible.length) % visible.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, visible.length]);

  const close = () => {
    setOpenIndex(null);
    opener.current?.focus();
  };

  if (!items.length) {
    return (
      <div className="columns-2 gap-4 md:columns-3 lg:gap-6">
        {RATIOS.map((r, i) => (
          <div key={i} className="photo-slot mb-4 break-inside-avoid lg:mb-6" style={{ aspectRatio: r }}>
            <span data-photo-caption>[Foto real — enviar pelo painel]</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {categories.length > 1 && (
        <div role="group" aria-label="Filtrar por categoria" className="mb-10 flex flex-wrap gap-x-6 gap-y-1">
          {["todas", ...categories].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
              className={`link-draw min-h-11 text-[0.975rem] ${filter === c ? "font-medium text-bisturi" : "text-cafe"}`}
            >
              {c === "todas" ? "Todas" : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      )}

      <ul className="columns-2 gap-4 md:columns-3 lg:gap-6">
        {visible.map((item, i) => (
          <li key={item.id} className="mb-4 break-inside-avoid lg:mb-6">
            <button
              type="button"
              className="photo-slot block w-full"
              style={{ aspectRatio: RATIOS[i % RATIOS.length] }}
              aria-label={`Ampliar: ${item.title ?? "foto da galeria"}`}
              onClick={(e) => {
                opener.current = e.currentTarget;
                setOpenIndex(i);
              }}
            >
              <Image src={item.image_url} alt={item.title ?? ""} fill sizes="(min-width: 1024px) 30vw, 50vw" className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-soft)] hover:scale-[1.03]" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>

      <dialog ref={dialog} onClose={close} onClick={(e) => e.target === dialog.current && close()} aria-label="Foto ampliada" className="m-auto overscroll-contain h-dvh max-h-none w-screen max-w-none bg-espresso/95 p-0 text-porcelana backdrop:bg-espresso">
        {current && (
          <div className="on-dark relative flex h-full flex-col">
            <div className="flex items-center justify-between px-[var(--spacing-gutter)] py-4">
              <p className="tnum text-[0.9rem]">
                {(openIndex ?? 0) + 1} / {visible.length}
                {current.title ? ` — ${current.title}` : ""}
              </p>
              <button type="button" onClick={close} className="min-h-11 px-2 text-[0.95rem]">
                Fechar
              </button>
            </div>
            <div className="relative flex-1">
              <Image src={current.image_url} alt={current.title ?? "Foto da galeria"} fill sizes="100vw" className="object-contain" />
            </div>
            <div className="flex justify-between px-[var(--spacing-gutter)] py-4">
              <button type="button" className="min-h-11 px-2" onClick={() => setOpenIndex((openIndex! - 1 + visible.length) % visible.length)}>
                Anterior
              </button>
              <button type="button" className="min-h-11 px-2" onClick={() => setOpenIndex((openIndex! + 1) % visible.length)}>
                Próxima
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
