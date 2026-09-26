"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { CATEGORY_SHORT, serviceFacts } from "@/lib/format";
import type { Service, ServiceCategory } from "@/lib/types";

const ORDER: ServiceCategory[] = ["facial_olhar", "corporal_modelagem", "terapias_bem_estar"];

/**
 * Catálogo editorial: índice de categorias à esquerda, tratamentos em linhas grandes à direita.
 * Só aparece o que é conhecido: sem descrição, duração confirmada ou valor, a linha fica só com o nome.
 */
export function Procedures({ services, level = 3 }: { services: Service[]; level?: 2 | 3 }) {
  // Na página /tratamentos o título da página é h1, então a lista começa em h2 (sem pular nível).
  const Heading = level === 2 ? "h2" : "h3";
  const tabsId = useId();
  const categories = ORDER.filter((c) => services.some((s) => s.category === c));
  const [current, setCurrent] = useState<ServiceCategory>(categories[0] ?? "facial_olhar");

  if (!services.length) {
    return <p className="t-lead text-cafe">Os tratamentos serão publicados em breve.</p>;
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
      <div className="min-w-0 lg:sticky lg:top-28 lg:col-span-3 lg:self-start">
        <div
          role="tablist"
          aria-label="Categorias de tratamentos"
          className="no-scrollbar -mx-[var(--spacing-gutter)] flex gap-8 overflow-x-auto border-b border-linha px-[var(--spacing-gutter)] lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:border-b-0 lg:px-0"
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
                className={`group flex min-h-12 shrink-0 items-baseline gap-3 py-2 text-left font-serif text-[1.5rem] font-light leading-tight tracking-[-0.015em] transition-colors duration-[var(--duration-quick)] lg:text-[2rem] ${
                  selected ? "text-espresso" : "text-cafe hover:text-espresso"
                }`}
              >
                <span className={`relative ${selected ? "after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-bisturi" : ""}`}>{CATEGORY_SHORT[c]}</span>
                <span className="tnum font-sans text-[0.8125rem] text-cafe">{count}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-8 hidden max-w-[26ch] text-[0.95rem] text-cafe lg:block">
          Em dúvida por onde começar?{" "}
          <Link href="/triagem" className="link-draw text-espresso">
            Descobrir meu tratamento
          </Link>
        </p>
      </div>

      <div key={current} id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-tab-${current}`} className="swap-in lg:col-span-9">
        <ul className="border-t border-linha">
          {list.map((s) => {
            const facts = serviceFacts(s);
            return (
              <li key={s.id} className="group grid gap-x-8 gap-y-3 border-b border-linha py-6 md:grid-cols-[1fr_auto] md:items-baseline md:py-8">
                <div>
                  <Heading className="t-h3 lg:text-[2.25rem]">
                    <Link href={`/tratamentos/${s.slug}`} className="transition-colors duration-[var(--duration-quick)] group-hover:text-bisturi">
                      {s.name}
                    </Link>
                  </Heading>
                  {s.indication && <p className="mt-2 max-w-[52ch] text-[0.95rem] text-cafe">{s.indication}</p>}
                  {s.description && <p className="mt-3 max-w-[60ch]">{s.description}</p>}
                </div>

                <div className="tnum flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[0.95rem] md:justify-end">
                  {facts.map((f) => (
                    <span key={f} className="text-cafe">
                      {f}
                    </span>
                  ))}
                  <Link href={`/agendamento?servico=${s.slug}`} className="link-draw font-medium text-bisturi">
                    Agendar
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-8 text-[0.95rem] text-cafe lg:hidden">
          Em dúvida por onde começar?{" "}
          <Link href="/triagem" className="link-draw text-espresso">
            Descobrir meu tratamento
          </Link>
        </p>
      </div>
    </div>
  );
}
