import { monthName } from "@/lib/date";
import type { MonthPoint } from "@/lib/finance";
import { formatMoney } from "@/lib/format";

/**
 * Série mensal em barras finas de CSS: recebido (verde) e pago (rosé) por mês.
 * Os valores estão escritos ao lado; a barra é só uma leitura rápida.
 */
export function MonthBars({ points }: { points: MonthPoint[] }) {
  const max = Math.max(1, ...points.flatMap((p) => [p.received, p.paid]));
  const pct = (v: number) => `${Math.max(v > 0 ? 1 : 0, (v / max) * 100)}%`;

  return (
    <div>
      <ul className="border-t border-linha">
        {points.map((p) => {
          const [year, m] = p.month.split("-").map(Number);
          return (
            <li key={p.month} className="grid grid-cols-[3.75rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1 border-b border-linha py-3 md:grid-cols-[3.75rem_minmax(0,1fr)_13rem]">
              <span className="tnum t-small capitalize">
                {monthName(m - 1).slice(0, 3)}/{String(year).slice(2)}
              </span>
              <span className="grid gap-1" aria-hidden>
                <span className="block h-1.5 bg-bisturi" style={{ width: pct(p.received) }} />
                <span className="block h-1.5 bg-rose" style={{ width: pct(p.paid) }} />
              </span>
              <span className="tnum t-small col-span-2 md:col-span-1 md:text-right">
                <span className="block">Recebido {formatMoney(p.received)}</span>
                <span className="block">Pago {formatMoney(p.paid)}</span>
                <span className={`block font-medium ${p.result < 0 ? "text-alerta" : "text-espresso"}`}>Resultado {formatMoney(p.result)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="t-small mt-3">Barra verde: recebido. Barra rosé: pago.</p>
    </div>
  );
}
