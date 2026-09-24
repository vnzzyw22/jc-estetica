"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_LINKS } from "@/lib/site";

export function Nav({ name }: { name: string }) {
  const pathname = usePathname();
  // O menu guarda a rota em que foi aberto: navegar para outra rota o fecha sem efeito extra.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean) => setOpenAt(value ? pathname : null);
  const [scrolled, setScrolled] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={`sticky top-0 z-40 bg-porcelana transition-[border-color] duration-[var(--duration-base)] ${
        scrolled ? "border-b border-linha" : "border-b border-transparent"
      }`}
    >
      <div className="wrap flex h-[var(--nav-h)] items-center justify-between gap-6">
        <Link href="/" className="font-serif text-[1.35rem] font-light leading-none tracking-[-0.02em] lg:text-[1.5rem]" aria-label={`${name} — início`}>
          {name}
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active(l.href) ? "page" : undefined}
              className={`link-draw text-[0.95rem] ${active(l.href) ? "text-bisturi" : "text-espresso"}`}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/agendamento" className="btn btn-sm">
            Agendar horário
          </Link>
        </nav>

        <div className="flex items-center gap-4 lg:hidden">
          <Link href="/agendamento" className="link-draw text-[0.95rem] font-medium">
            Agendar
          </Link>
          <button
            ref={openRef}
            type="button"
            className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-[0.95rem]"
            aria-expanded={open}
            aria-controls="menu-mobile"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        id="menu-mobile"
        aria-label="Menu"
        onClose={() => {
          setOpen(false);
          openRef.current?.focus();
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none overscroll-contain bg-porcelana p-0 text-espresso backdrop:bg-porcelana lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="wrap flex h-[var(--nav-h)] items-center justify-between">
            <span className="font-serif text-[1.35rem] font-light tracking-[-0.02em]">{name}</span>
            <button type="button" className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2" onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>
          <nav aria-label="Menu principal" className="wrap flex flex-1 flex-col justify-center gap-1 pb-16">
            {[{ href: "/", label: "Início" }, ...NAV_LINKS, { href: "/agendamento", label: "Agendar horário" }].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={pathname === l.href ? "page" : undefined}
                className={`border-b border-linha py-3 font-serif text-[2.1rem] font-light leading-tight tracking-[-0.02em] ${pathname === l.href ? "text-bisturi" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </dialog>
    </header>
  );
}
