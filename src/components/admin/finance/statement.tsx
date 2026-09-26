import Link from "next/link";
import { dayLabel } from "@/lib/date";
import type { DayGroup } from "@/lib/finance";
import { EXPENSE_KIND_LABEL, PAYMENT_KIND_LABEL, PAYMENT_METHOD_LABEL, formatMoney } from "@/lib/format";
import type { Client } from "@/lib/types";

/**
 * Extrato do mês, dia a dia. A direção aparece no sinal (+ / −) e o estado no texto:
 * ninguém precisa distinguir por cor.
 */
export function Statement({ groups, clients, today }: { groups: DayGroup[]; clients: Map<string, Client>; today: string }) {
  return (
    <div>
      {groups.map(({ date, rows }) => (
        <section key={date} aria-label={dayLabel(date)} className="border-t border-linha">
          <h3 className="tnum t-small pb-1 pt-4">
            {dayLabel(date, "short")}
          </h3>
          <ul>
            {rows.map((r) => {
              const incoming = r.direction === "in";
              const client = r.client_id ? clients.get(r.client_id) : undefined;
              const href = incoming ? `/admin/financeiro/recebimentos/${r.source_id}` : `/admin/financeiro/despesas/${r.source_id}`;
              const detail = incoming
                ? [client?.name, r.method ? PAYMENT_METHOD_LABEL[r.method] : null, PAYMENT_KIND_LABEL[r.category]].filter(Boolean).join(", ")
                : [r.category_name, EXPENSE_KIND_LABEL[r.category]?.toLowerCase()].filter(Boolean).join(", ");
              const expected = r.state === "expected";
              const late = expected && r.occurred_on < today;
              return (
                <li key={`${r.source}-${r.source_id}`}>
                  <Link href={href} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-0.5 py-2.5 transition-colors hover:bg-seda/60">
                    <span className="min-w-0">
                      <span className="block truncate">{r.description ?? (incoming ? "Recebimento" : "Despesa")}</span>
                      <span className="t-small block truncate">{detail}</span>
                    </span>
                    <span className="tnum text-right">
                      <span className="block font-medium">
                        {incoming ? "+ " : "− "}
                        {formatMoney(r.amount)}
                      </span>
                      {expected && <span className={`t-small block ${late ? "text-alerta" : ""}`}>{late ? "atrasado" : incoming ? "a receber" : "a pagar"}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="border-t border-linha" />
    </div>
  );
}
