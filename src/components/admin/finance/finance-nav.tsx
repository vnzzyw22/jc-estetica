"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/financeiro", label: "Visão geral", exact: true },
  { href: "/admin/financeiro/recebimentos", label: "Recebimentos" },
  { href: "/admin/financeiro/despesas", label: "Despesas" },
  { href: "/admin/financeiro/relatorios", label: "Relatórios" },
];

/** Abas do financeiro: texto simples com sublinhado (mesma linguagem da ficha da cliente). */
export function FinanceNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções do financeiro" className="no-scrollbar -mx-[var(--spacing-gutter)] mb-10 flex gap-x-5 overflow-x-auto border-b border-linha px-[var(--spacing-gutter)] sm:gap-x-8 lg:mx-0 lg:px-0">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 shrink-0 items-center border-b-2 transition-colors ${active ? "border-bisturi font-medium text-bisturi" : "border-transparent text-cafe hover:text-espresso"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
