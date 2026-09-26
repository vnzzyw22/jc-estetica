import Link from "next/link";
import { Breakdown } from "@/components/admin/finance/breakdown";
import { MonthBars } from "@/components/admin/finance/month-bars";
import { MonthSwitch } from "@/components/admin/finance/month-switch";
import { requireAdmin } from "@/lib/auth";
import { isoAt, todayISO } from "@/lib/date";
import { addMonths, isMonth, monthRange, monthSeries, overdueRows, queryString, sumBy, totalsOf } from "@/lib/finance";
import { loadFlowBetween, loadMonthFlow, loadOverdueFlow } from "@/lib/finance-data";
import { EXPENSE_KIND_LABEL, PAYMENT_KIND_LABEL, PAYMENT_METHOD_LABEL, formatMoney } from "@/lib/format";
import { SOURCE_LABEL } from "@/lib/screening";

export const metadata = { title: "Relatórios" };

type Search = Promise<{ mes?: string }>;

function Fact({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="border-t border-linha pt-3">
      <dt className="t-small">{label}</dt>
      <dd className="tnum mt-1 text-[1.35rem]">{value}</dd>
      {hint && <dd className="t-small mt-0.5">{hint}</dd>}
    </div>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="t-h3 mb-4">
      {children}
    </h2>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Search }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const month = isMonth(sp.mes) ? sp.mes : today.slice(0, 7);
  const { first, next } = monthRange(month);
  const fromISO = isoAt(first, "00:00");
  const toISO = isoAt(next, "00:00");

  const [flow, seriesRows, overdueAll, treatments, sessions, completed, newClients, screenings] = await Promise.all([
    loadMonthFlow(db, month),
    loadFlowBetween(db, addMonths(month, -5), month),
    loadOverdueFlow(db, today),
    db.list("treatments"),
    db.list("treatment_sessions", { gte: { performed_at: fromISO }, lt: { performed_at: toISO } }),
    db.list("appointments", { eq: { status: "completed" }, gte: { starts_at: fromISO }, lt: { starts_at: toISO } }),
    db.list("clients", { gte: { created_at: fromISO }, lt: { created_at: toISO } }),
    db.list("screenings", { gte: { created_at: fromISO }, lt: { created_at: toISO } }),
  ]);

  const t = totalsOf(flow);
  const inRealized = flow.filter((r) => r.direction === "in" && r.state === "realized");
  const outRealized = flow.filter((r) => r.direction === "out" && r.state === "realized");
  const lateIn = totalsOf(overdueRows(overdueAll, today, "in")).toReceive;
  const lateOut = totalsOf(overdueRows(overdueAll, today, "out")).toPay;

  // Compara instantes, não texto: o banco pode devolver "Z" ou "+00:00".
  const [fromMs, toMs] = [Date.parse(fromISO), Date.parse(toISO)];
  const inMonth = (iso: string | null) => iso !== null && Date.parse(iso) >= fromMs && Date.parse(iso) < toMs;
  const proposed = treatments.filter((x) => inMonth(x.proposed_at)).length;
  const started = treatments.filter((x) => inMonth(x.started_at)).length;
  const activeNow = treatments.filter((x) => x.status === "active" || x.status === "paused").length;
  const bySource = new Map<string, number>();
  for (const s of screenings) bySource.set(s.source, (bySource.get(s.source) ?? 0) + 1);

  return (
    <>
      <MonthSwitch month={month} path="/admin/financeiro/relatorios" />

      <section aria-labelledby="resumo" className="mb-16 max-w-4xl">
        <H2 id="resumo">Resultado de {month.split("-").reverse().join("/")}</H2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
          <Fact label="Recebido" value={formatMoney(t.received)} />
          <Fact label="Pago" value={formatMoney(t.paid)} />
          <Fact label="Resultado" value={formatMoney(t.result)} hint="recebido menos pago" />
          <Fact label="Previsão de fechamento" value={formatMoney(t.forecast)} hint="se tudo o que está previsto acontecer" />
        </dl>
      </section>

      <section aria-labelledby="serie" className="mb-16 max-w-4xl">
        <H2 id="serie">Últimos 6 meses</H2>
        <MonthBars points={monthSeries(seriesRows, month, 6)} />
      </section>

      <div className="mb-16 grid gap-x-12 gap-y-14 xl:grid-cols-2">
        <section aria-labelledby="por-forma">
          <H2 id="por-forma">Recebido por forma de pagamento</H2>
          <Breakdown slices={sumBy(inRealized, (r) => r.method ?? "none")} label={(k) => PAYMENT_METHOD_LABEL[k] ?? "Sem forma informada"} empty="Nenhum recebimento no mês." />
        </section>
        <section aria-labelledby="por-tipo">
          <H2 id="por-tipo">Recebido por tipo</H2>
          <Breakdown slices={sumBy(inRealized, (r) => r.category)} label={(k) => PAYMENT_KIND_LABEL[k] ?? k} empty="Nenhum recebimento no mês." />
        </section>
        <section aria-labelledby="por-categoria">
          <H2 id="por-categoria">Despesas por categoria</H2>
          <Breakdown slices={sumBy(outRealized, (r) => r.category_name ?? "none")} label={(k) => (k === "none" ? "Sem categoria" : k)} empty="Nenhuma despesa paga no mês." />
        </section>
        <section aria-labelledby="fixas-variaveis">
          <H2 id="fixas-variaveis">Despesas fixas e variáveis</H2>
          <Breakdown slices={sumBy(outRealized, (r) => r.category)} label={(k) => (EXPENSE_KIND_LABEL[k] ?? k) + "s"} empty="Nenhuma despesa paga no mês." />
        </section>
      </div>

      <section aria-labelledby="pendencias" className="mb-16 max-w-4xl">
        <H2 id="pendencias">Pendências</H2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
          <Fact label="A receber no mês" value={formatMoney(t.toReceive)} />
          <Fact label="A pagar no mês" value={formatMoney(t.toPay)} />
          <Fact label="Recebimentos atrasados" value={formatMoney(lateIn)} hint="todos os meses" />
          <Fact label="Despesas atrasadas" value={formatMoney(lateOut)} hint="todos os meses" />
        </dl>
        {(lateIn > 0 || lateOut > 0) && (
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[0.95rem]">
            {lateIn > 0 && (
              <Link href={`/admin/financeiro/recebimentos${queryString({ filtro: "atrasados" })}`} className="link-draw font-medium">
                Ver recebimentos atrasados
              </Link>
            )}
            {lateOut > 0 && (
              <Link href={`/admin/financeiro/despesas${queryString({ filtro: "atrasadas" })}`} className="link-draw font-medium">
                Ver despesas atrasadas
              </Link>
            )}
          </p>
        )}
      </section>

      <section aria-labelledby="atividade" className="max-w-4xl">
        <H2 id="atividade">Atividade do mês</H2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
          <Fact label="Atendimentos concluídos" value={completed.length} />
          <Fact label="Sessões de tratamento" value={sessions.length} hint="realizadas" />
          <Fact label="Tratamentos propostos" value={proposed} />
          <Fact label="Tratamentos iniciados" value={started} hint={`${activeNow} ativo${activeNow === 1 ? "" : "s"} agora`} />
          <Fact label="Clientes novas" value={newClients.length} />
          <Fact label="Triagens recebidas" value={screenings.length} />
        </dl>
        {bySource.size > 0 && (
          <div className="mt-8">
            <h3 className="t-small mb-2">De onde vieram as triagens</h3>
            <ul className="tnum border-t border-linha">
              {[...bySource.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([source, n]) => (
                  <li key={source} className="flex justify-between gap-6 border-b border-linha py-2.5">
                    <span>{SOURCE_LABEL[source] ?? source}</span>
                    <span>{n}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
