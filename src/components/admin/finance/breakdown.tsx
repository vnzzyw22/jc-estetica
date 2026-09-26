import { formatMoney } from "@/lib/format";
import type { Slice } from "@/lib/finance";

/** Quanto cada chave pesa no total: nome, valor, participação e uma barra fina. */
export function Breakdown({ slices, label, empty }: { slices: Slice[]; label: (key: string) => string; empty: string }) {
  const total = slices.reduce((sum, s) => sum + Math.round(s.total * 100), 0) / 100;
  if (!slices.length) return <p className="t-small">{empty}</p>;
  return (
    <ul className="border-t border-linha">
      {slices.map((s) => {
        const share = total > 0 ? Math.round((s.total / total) * 100) : 0;
        return (
          <li key={s.key} className="border-b border-linha py-3">
            <div className="flex items-baseline justify-between gap-6">
              <span className="min-w-0 break-words">{label(s.key)}</span>
              <span className="tnum shrink-0 text-right">
                {formatMoney(s.total)} <span className="t-small">{share}%</span>
              </span>
            </div>
            <span aria-hidden className="mt-2 block h-px bg-linha">
              <span className="block h-px bg-bisturi" style={{ width: `${share}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
