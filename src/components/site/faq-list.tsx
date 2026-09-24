"use client";

import { useId, useState } from "react";
import type { FaqItem } from "@/lib/types";

/** Accordion editorial: linhas finas, pergunta em serifada, +/− tipográfico. Uma aberta por vez. */
export function FaqList({ items, level = 3 }: { items: FaqItem[]; level?: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3";
  const base = useId();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!items.length) return <p className="text-cafe">As perguntas frequentes serão publicadas em breve.</p>;

  return (
    <ul className="border-t border-linha">
      {items.map((item) => {
        const open = openId === item.id;
        const panelId = `${base}-${item.id}`;
        return (
          <li key={item.id} className="border-b border-linha">
            <Heading>
              <button
                id={`${base}-${item.id}-q`}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : item.id)}
                className="flex min-h-16 w-full items-center justify-between gap-6 py-5 text-left font-serif text-[1.35rem] font-light leading-snug tracking-[-0.01em] lg:text-[1.6rem]"
              >
                <span>{item.question}</span>
                <span aria-hidden className="font-sans text-2xl font-light leading-none text-bisturi">
                  {open ? "−" : "+"}
                </span>
              </button>
            </Heading>
            <div
              id={panelId}
              role="region"
              aria-labelledby={`${base}-${item.id}-q`}
              className={`grid transition-[grid-template-rows] duration-[var(--duration-base)] ease-[var(--ease-soft)] ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <p className={`max-w-[62ch] pb-6 text-cafe transition-opacity duration-[var(--duration-base)] ${open ? "opacity-100" : "opacity-0"}`}>{item.answer}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
