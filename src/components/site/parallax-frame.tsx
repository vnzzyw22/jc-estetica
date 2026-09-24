"use client";

import { useEffect, useRef } from "react";

interface ParallaxFrameProps {
  children: React.ReactNode;
  className?: string;
  /** Deslocamento vertical máximo em px. */
  shift?: number;
}

/** Foto do hero (o alvo é o [data-media] do ImageFrame; marcas de registro ficam fixas): escala 1.08 → 1 e desloca poucos pixels enquanto rola. Respeita reduced-motion. */
export function ParallaxFrame({ children, className = "", shift = 28 }: ParallaxFrameProps) {
  const outer = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const el = outer.current;
    const target = el?.querySelector<HTMLElement>("[data-media]");
    if (!el || !target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));
      const scale = 1.08 - 0.08 * Math.min(1, progress * 2);
      target.style.transformOrigin = "50% 30%";
      target.style.transform = `translate3d(0, ${progress * shift}px, 0) scale(${scale})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shift]);

  return (
    <div ref={outer} className={className}>
      {children}
    </div>
  );
}
