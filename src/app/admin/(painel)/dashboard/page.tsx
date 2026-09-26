import Link from "next/link";
import { AppointmentLine } from "@/components/admin/appointment-line";
import { ProgressLine } from "@/components/admin/treatment/chips";
import { Empty, Metric, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard-data";
import { dateTimeLabel, dayLabel, monthName, nowISO } from "@/lib/date";
import { formatMoney } from "@/lib/format";

export const metadata = { title: "Dashboard" };

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-t border-linha pt-3">
      <dt className="t-small">{label}</dt>
      <dd className="tnum mt-1 text-[1.2rem]">{formatMoney(value)}</dd>
    </div>
  );
}

export default async function DashboardPage() {
  const { db } = await requireAdmin();
  const nowMs = Date.parse(nowISO());
  const d = await loadDashboard(db, nowMs);
  const monthIndex = Number(d.month.slice(5, 7)) - 1;

  return (
    <>
      <PageTitle title="Dashboard">
        <Link href="/admin/agendamentos?novo=1" className="btn btn-sm">
          Novo agendamento
        </Link>
        <Link href="/admin/financeiro/recebimentos?novo=1" className="btn btn-sm btn-ghost">
          Novo recebimento
        </Link>
      </PageTitle>

      <section aria-labelledby="atencao" className="mb-14 max-w-3xl">
        <h2 id="atencao" className="t-h3 mb-4">
          Precisa de atenção
        </h2>
        {d.attention.length === 0 ? (
          <p className="border-t border-linha pt-4 text-cafe">Tudo em dia. Nada precisa da sua atenção agora.</p>
        ) : (
          <ul className="border-t border-linha">
            {d.attention.map((item) => (
              <li key={item.key} className="border-b border-linha">
                <Link href={item.href} className="flex items-baseline justify-between gap-6 px-1 py-3.5 transition-colors hover:bg-seda/60">
                  <span className={`link-draw ${item.tone === "late" ? "text-alerta" : ""}`}>{item.text}</span>
                  {item.amount !== undefined && <span className="tnum shrink-0">{formatMoney(item.amount)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mb-14 grid max-w-3xl grid-cols-3 gap-x-6">
        <Metric value={d.todayList.length} label="Hoje" />
        <Metric value={d.weekCount} label="Próximos 7 dias" />
        <Metric value={d.inProgress.length} label="Tratamentos em andamento" />
      </div>

      <div className="grid gap-x-14 gap-y-14 xl:grid-cols-2">
        <div className="grid content-start gap-14">
          <section aria-labelledby="hoje">
            <h2 id="hoje" className="t-h3 mb-1">
              Agenda de hoje
            </h2>
            <p className="t-small mb-4">{dayLabel(d.today)}</p>
            {d.todayList.length ? (
              <ul className="border-t border-linha">
                {d.todayList.map((a) => (
                  <AppointmentLine key={a.id} a={a} />
                ))}
              </ul>
            ) : (
              <Empty>Nenhum atendimento hoje.</Empty>
            )}
          </section>

          <section aria-labelledby="proximos">
            <h2 id="proximos" className="t-h3 mb-1">
              Próximos agendamentos
            </h2>
            <p className="t-small mb-4">Nos próximos 14 dias</p>
            {d.upcoming.length ? (
              <ul className="border-t border-linha">
                {d.upcoming.map((a) => (
                  <AppointmentLine key={a.id} a={a} showDate />
                ))}
              </ul>
            ) : (
              <Empty>Nada agendado para os próximos dias.</Empty>
            )}
          </section>
        </div>

        <div className="grid content-start gap-14">
          <section aria-labelledby="dinheiro">
            <h2 id="dinheiro" className="t-h3 mb-1">
              Financeiro de {monthName(monthIndex)}
            </h2>
            <p className="t-small mb-3">Recebido menos pago no mês</p>
            <p className={`tnum font-serif text-[2.75rem] font-light leading-none ${d.money.result < 0 ? "text-alerta" : ""}`}>{formatMoney(d.money.result)}</p>
            <dl className="mt-6 grid max-w-md grid-cols-3 gap-x-5">
              <Figure label="Recebido" value={d.money.received} />
              <Figure label="A receber" value={d.money.toReceive} />
              <Figure label="A pagar" value={d.money.toPay} />
            </dl>
            <Link href="/admin/financeiro" className="link-draw mt-6 inline-block text-[0.95rem] font-medium">
              Abrir o financeiro
            </Link>
          </section>

          <section aria-labelledby="tratamentos">
            <h2 id="tratamentos" className="t-h3 mb-4">
              Tratamentos em andamento
            </h2>
            {d.inProgress.length === 0 ? (
              <Empty>Nenhum tratamento em andamento.</Empty>
            ) : (
              <ul className="border-t border-linha">
                {d.inProgress.slice(0, 6).map(({ treatment: t, client, progress, nextAt, pastOpen }) => (
                  <li key={t.id} className="border-b border-linha">
                    <Link href={`/admin/tratamentos/${t.id}`} className="grid gap-x-6 gap-y-1 px-1 py-3.5 transition-colors hover:bg-seda/60 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-baseline">
                      <span className="min-w-0">
                        <span className="block font-medium">{t.name}</span>
                        <span className="t-small block">{client?.name ?? "Cliente removida"}</span>
                        <span className={`tnum t-small block ${pastOpen > 0 ? "text-alerta" : ""}`}>
                          {nextAt ? (pastOpen > 0 ? `Passou em ${dateTimeLabel(nextAt)}: falta marcar como realizada` : `Próxima: ${dateTimeLabel(nextAt)}`) : "Sem sessão marcada"}
                        </span>
                      </span>
                      <ProgressLine progress={progress} compact />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/tratamentos" className="link-draw mt-6 inline-block text-[0.95rem] font-medium">
              Ver todos os tratamentos
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
