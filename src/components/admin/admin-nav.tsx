"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/triagens", label: "Triagens" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/agendamentos", label: "Agendamentos" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/servicos", label: "Serviços" },
  { href: "/admin/horarios", label: "Horários" },
  { href: "/admin/bloqueios", label: "Bloqueios" },
  { href: "/admin/galeria", label: "Galeria" },
  { href: "/admin/conteudo", label: "Conteúdo" },
  { href: "/admin/faq", label: "FAQ" },
  { href: "/admin/consentimento", label: "Consentimento" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export function AdminNav({ newScreenings = 0 }: { newScreenings?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Painel" className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-[0.95rem] transition-colors lg:border-b-0 lg:border-l-2 ${
              active ? "border-bisturi font-medium text-bisturi" : "border-transparent text-cafe hover:text-espresso"
            }`}
          >
            {l.label}
            {l.href === "/admin/triagens" && newScreenings > 0 && (
              <span className="tnum ml-2 rounded-ctl bg-espresso px-1.5 text-[0.75rem] text-porcelana" aria-label={`${newScreenings} nova${newScreenings === 1 ? "" : "s"}`}>
                {newScreenings}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
