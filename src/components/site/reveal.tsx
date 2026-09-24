"use client";

import { useEffect, useRef, useState } from "react";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "p" | "section";
}

/** Revela texto longo só com opacidade (sem slide-up). Sem JS/observer o conteúdo aparece. */
export function Reveal({ children, className = "", as: Tag = "div" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    setArmed(true);
    // Já visível na carga: não esconde para depois revelar (evita piscar).
    if (el.getBoundingClientRect().top < window.innerHeight * 0.88) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`${armed ? "reveal" : ""} ${className}`}
      data-in={visible ? "true" : undefined}
    >
      {children}
    </Tag>
  );
}
