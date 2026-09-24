"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { CATEGORY_SHORT, formatDuration, formatPrice } from "@/lib/format";
import type { Service, ServiceCategory } from "@/lib/types";

const ORDER: ServiceCategory[] = ["facial_olhar", "corporal_modelagem", "terapias_bem_estar"];

/**
 * Catálogo editorial: índice de categorias à esquerda, procedimentos em linhas grandes à direita.
 * Nada de cards: nome, indicação, duração e preço numa linha de leitura.
 */
export function Procedures({ services }: { services: Service[] }) {
  const tabsId = useId();
  const categories = ORDER.filter((c) => services.some((s) => s.category === c));
  const [current, setCurrent] = useState<ServiceCategory>(categories[0] ?? "facial_olhar");

  if (!services.length) {
    return <p className="t-lead text-cafe">Os procedimentos serão publicados em breve.</p>;
  }

  const list = services.filter((s) => s.category === current);

  const onKey = (e: React.KeyboardEvent, idx: number) => {
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = categories[(idx + dir + categories.length) % categories.length];
    setCurrent(next);
    document.getElementById(`${tabsId}-tab-${next}`)?.focus();
  };

  return (
    <div className="grid gap-x-6 gap-y-8 lg:grid-cols-12">
      <div
        role="tablist"
        aria-label="Categorias de procedimentos"
        className="no-scrollbar -mx-[var(--spacing-gutter)] flex gap-8 overflow-x-auto border-b border-linha px-[var(--spacing-gutter)] lg:sticky lg:top-28 lg:col-span-3 lg:mx-0 lg:flex-col lg:gap-1 lg:self-start lg:overflow-visible lg:border-b-0 lg:px-0"
      >
        {categories.map((c, idx) => {
          const selected = c === current;
          const count = services.filter((s) => s.category === c).length;
          return (
            <button
              key={c}
              id={`${tabsId}-tab-${c}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${tabsId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setCurrent(c)}
              onKeyDown={(e) => onKey(e, idx)}
              className={`group flex min-h-12 shrink-0 items-baseline gap-3 py-2 text-left font-serif text-[1.6rem] font-light leading-none tracking-[-0.015em] transition-colors duration-[var(--duration-quick)] lg:text-[2.4rem] ${
                selected ? "text-espresso" : "text-cafe/60 hover:text-espresso"
              }`}
            >
              <span className={`relative ${selected ? "after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-bisturi" : ""}`}>{CATEGORY_SHORT[c]}</span>
              <span className="tnum font-sans text-[0.8125rem] text-cafe">{count}</span>
            </button>
          );
        })}
      </div>

      <div key={current} id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-tab-${current}`} className="swap-in lg:col-span-9">
        <ul className="border-t border-linha">
          {list.map((s) => (
            <li key={s.id} className="group grid gap-x-8 gap-y-3 border-b border-linha py-7 md:grid-cols-[1fr_auto] md:py-9">
              <div>
                <h3 className="t-h3 lg:text-[2.25rem]">
                  <Link href={`/servicos/${s.slug}`} className="transition-colors duration-[var(--duration-quick)] group-hover:text-bisturi">
                    {s.name}
                  </Link>
                </h3>
                {s.indication && <p className="mt-2 max-w-[52ch] text-[0.95rem] text-cafe">{s.indication}</p>}
                {s.description && <p className="mt-3 max-w-[60ch]">{s.description}</p>}
              </div>

              <div className="tnum flex items-end gap-x-8 md:flex-col md:items-end md:justify-between md:text-right">
                <p className="text-[0.95rem]">
                  <span className="text-cafe">{formatDuration(s.duration_minutes)}</span>
                  <span className="mx-3 text-linha">|</span>
                  <span>{formatPrice(s.price)}</span>
                </p>
                <Link href={`/agendamento?servico=${s.slug}`} className="link-draw ml-auto font-medium text-bisturi md:ml-0">
                  Agendar este
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
