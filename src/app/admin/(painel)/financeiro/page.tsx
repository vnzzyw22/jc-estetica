import Link from "next/link";
import { Notice } from "@/components/admin/finance/notice";
import { MonthSwitch } from "@/components/admin/finance/month-switch";
import { Statement } from "@/components/admin/finance/statement";
import { Empty } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/date";
import { groupByDay, isMonth, overdueRows, queryString, totalsOf } from "@/lib/finance";
import { loadClientMap, loadMonthFlow, loadOverdueFlow } from "@/lib/finance-data";
import { formatMoney } from "@/lib/format";

type Search = Promise<{ mes?: string; erro?: string; aviso?: string }>;

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="border-t border-linha pt-3">
      <dt className="t-small">{label}</dt>
      <dd className="tnum mt-1 text-[1.35rem]">{formatMoney(value)}</dd>
      {hint && <dd className="t-small mt-0.5">{hint}</dd>}
    </div>
  );
}

export default async function FinanceOverviewPage({ searchParams }: { searchParams: Search }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const month = isMonth(sp.mes) ? sp.mes : today.slice(0, 7);

  const [rows, overdueAll, clients] = await Promise.all([loadMonthFlow(db, month), loadOverdueFlow(db, today), loadClientMap(db)]);
  const t = totalsOf(rows);
  const lateIn = overdueRows(overdueAll, today, "in");
  const lateOut = overdueRows(overdueAll, today, "out");
  const lateInSum = totalsOf(lateIn).toReceive;
  const lateOutSum = totalsOf(lateOut).toPay;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <>
      <Notice erro={sp.erro} aviso={sp.aviso} />
      <MonthSwitch month={month} path="/admin/financeiro" />

      <section aria-labelledby="resultado">
        <h2 id="resultado" className="t-small">
          Resultado do mês
        </h2>
        <p className={`tnum mt-3 font-serif text-[clamp(3rem,9vw,5.5rem)] font-light leading-none ${t.result < 0 ? "text-alerta" : ""}`}>{formatMoney(t.result)}</p>
        <p className="t-small mt-3 max-w-[56ch]">Recebido menos pago no mês. Se tudo o que está previsto acontecer, o mês fecha em <span className="tnum">{formatMoney(t.forecast)}</span>.</p>

        <dl className="mt-8 grid max-w-4xl grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
          <Figure label="Recebido" value={t.received} />
          <Figure label="Pago" value={t.paid} />
          <Figure label="A receber" value={t.toReceive} hint="previsto no mês" />
          <Figure label="A pagar" value={t.toPay} hint="previsto no mês" />
        </dl>
      </section>

      {(lateIn.length > 0 || lateOut.length > 0) && (
        <section aria-labelledby="atrasos" className="mt-12 max-w-2xl border-l-2 border-alerta pl-4">
          <h2 id="atrasos" className="t-h3 mb-2">
            Atrasados
          </h2>
          <ul className="grid gap-1.5">
            {lateIn.length > 0 && (
              <li>
                {plural(lateIn.length, "recebimento atrasado", "recebimentos atrasados")}, <span className="tnum">{formatMoney(lateInSum)}</span>.{" "}
                <Link href={`/admin/financeiro/recebimentos${queryString({ filtro: "atrasados" })}`} className="link-draw font-medium">
                  Ver e cobrar
                </Link>
              </li>
            )}
            {lateOut.length > 0 && (
              <li>
                {plural(lateOut.length, "despesa atrasada", "despesas atrasadas")}, <span className="tnum">{formatMoney(lateOutSum)}</span>.{" "}
                <Link href={`/admin/financeiro/despesas${queryString({ filtro: "atrasadas" })}`} className="link-draw font-medium">
                  Ver e pagar
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <section aria-labelledby="extrato" className="mt-14 max-w-3xl">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="extrato" className="t-h3">
            Extrato do mês
          </h2>
          {rows.length > 0 && (
            <a href={`/admin/financeiro/exportar${queryString({ mes: month })}`} className="link-draw text-[0.9rem]">
              Baixar planilha (CSV)
            </a>
          )}
        </div>
        {rows.length === 0 ? (
          <Empty>
            Nada registrado neste mês. Comece por um <Link href="/admin/financeiro/recebimentos?novo=1" className="link-draw">recebimento</Link> ou uma{" "}
            <Link href="/admin/financeiro/despesas?novo=1" className="link-draw">despesa</Link>.
          </Empty>
        ) : (
          <Statement groups={groupByDay(rows)} clients={clients} today={today} />
        )}
      </section>
    </>
  );
}
