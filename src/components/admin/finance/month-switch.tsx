import Link from "next/link";
import { monthName, todayISO } from "@/lib/date";
import { addMonths, queryString } from "@/lib/finance";

interface MonthSwitchProps {
  month: string;
  /** Rota da página (sem query). */
  path: string;
  /** Outros parâmetros a preservar ao trocar de mês (ex.: o filtro escolhido). */
  keep?: Record<string, string | undefined>;
}

/** Mês anterior / hoje / próximo, como links: a página inteira é de servidor. */
export function MonthSwitch({ month, path, keep = {} }: MonthSwitchProps) {
  const current = todayISO().slice(0, 7);
  const [year, m] = month.split("-").map(Number);
  const to = (target: string) => `${path}${queryString({ ...keep, mes: target === current ? undefined : target })}`;

  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-3">
      <Link href={to(addMonths(month, -1))} className="btn btn-sm btn-ghost" aria-label="Mês anterior">
        ‹
      </Link>
      <Link href={to(addMonths(month, 1))} className="btn btn-sm btn-ghost" aria-label="Próximo mês">
        ›
      </Link>
      <p className="ml-3 font-serif text-[1.4rem] font-light capitalize" aria-live="polite">
        {monthName(m - 1)} <span className="tnum">{year}</span>
      </p>
      {month !== current && (
        <Link href={to(current)} className="link-draw ml-3 text-[0.9rem]">
          Voltar para este mês
        </Link>
      )}
    </div>
  );
}
