"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A régua: escala fina na margem esquerda (desktop) que marca onde você está na página.
 * No mobile vira uma barra de progresso de 2px no topo. Função real: orientação de scroll
 * + nome da seção atual (lido de [data-section]).
 */
export function Ruler() {
  const pathname = usePathname();
  const marker = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    let frame = 0;
    let sections: HTMLElement[] = [];

    const collect = () => {
      sections = Array.from(document.querySelectorAll<HTMLElement>("[data-section]"));
    };

    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (marker.current) marker.current.style.setProperty("--p", String(p));
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;

      const probe = window.innerHeight * 0.4;
      let current = "";
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= probe) current = s.dataset.section ?? "";
      }
      setLabel((prev) => (prev === current ? prev : current));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    collect();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return (
    <>
      <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-0.5 lg:hidden">
        <div ref={bar} className="h-full origin-left bg-bisturi" style={{ transform: "scaleX(0)" }} />
      </div>

      <div
        ref={marker}
        aria-hidden
        className="pointer-events-none fixed inset-y-0 left-0 z-30 hidden w-14 text-white mix-blend-difference lg:block"
        style={{ ["--p" as string]: 0 }}
      >
        {/* Linha-mestra e ticks a cada 12px; um tick longo a cada 60px */}
        <div className="absolute inset-y-0 right-4 w-px bg-current opacity-30" />
        <div
          className="absolute inset-y-0 right-4 w-1.5 opacity-40"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, currentColor 0 1px, transparent 1px 12px)" }}
        />
        <div
          className="absolute inset-y-0 right-4 w-3 opacity-50"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, currentColor 0 1px, transparent 1px 60px)" }}
        />
        {/* Marcador de posição */}
        <div
          className="absolute right-4 h-px w-5 bg-current"
          style={{ top: "calc(var(--nav-h) + var(--p) * (100dvh - var(--nav-h) - 1.5rem))" }}
        />
        {/* Seção atual, na vertical */}
        <span
          className="absolute bottom-8 right-8 rotate-180 text-[0.8125rem] tracking-wide opacity-80 [writing-mode:vertical-rl]"
        >
          {label}
        </span>
      </div>
    </>
  );
}
