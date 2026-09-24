import Link from "next/link";
import { AppointmentLine } from "@/components/admin/appointment-line";
import { Empty, Metric, PageTitle } from "@/components/admin/ui";
import { listAppointmentDetails } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { addDaysISO, dayLabel, isoAt, todayISO } from "@/lib/date";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { db } = await requireAdmin();
  const today = todayISO();
  const now = new Date().toISOString();

  const [todayList, upcoming, pending, clients, services, week] = await Promise.all([
    listAppointmentDetails(db, { fromISO: isoAt(today, "00:00"), toISO: isoAt(addDaysISO(today, 1), "00:00") }),
    listAppointmentDetails(db, { fromISO: isoAt(addDaysISO(today, 1), "00:00"), toISO: isoAt(addDaysISO(today, 15), "00:00") }),
    db.list("appointments", { eq: { status: "pending" }, gte: { starts_at: now } }),
    db.list("clients"),
    db.list("services", { eq: { active: true } }),
    listAppointmentDetails(db, { fromISO: isoAt(today, "00:00"), toISO: isoAt(addDaysISO(today, 7), "00:00") }),
  ]);

  const todayActive = todayList.filter((a) => a.status !== "cancelled");
  const upcomingActive = upcoming.filter((a) => a.status !== "cancelled").slice(0, 8);
  const weekCount = week.filter((a) => a.status !== "cancelled").length;

  return (
    <>
      <PageTitle title="Dashboard">
        <Link href="/admin/agendamentos?novo=1" className="btn btn-sm">
          Novo agendamento
        </Link>
      </PageTitle>

      <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-5">
        <Metric value={todayActive.length} label="Hoje" />
        <Metric value={weekCount} label="Próximos 7 dias" />
        <Metric value={pending.length} label="Aguardando confirmação" />
        <Metric value={clients.length} label="Clientes" />
        <Metric value={services.length} label="Serviços ativos" />
      </div>

      <div className="mt-14 grid gap-x-12 gap-y-12 xl:grid-cols-2">
        <section aria-labelledby="hoje">
          <h2 id="hoje" className="t-h3 mb-1">
            Agenda de hoje
          </h2>
          <p className="t-small mb-4">{dayLabel(today)}</p>
          {todayActive.length ? (
            <ul className="border-t border-linha">
              {todayActive.map((a) => (
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
          {upcomingActive.length ? (
            <ul className="border-t border-linha">
              {upcomingActive.map((a) => (
                <AppointmentLine key={a.id} a={a} showDate />
              ))}
            </ul>
          ) : (
            <Empty>Nada agendado para os próximos dias.</Empty>
          )}
        </section>
      </div>
    </>
  );
}
