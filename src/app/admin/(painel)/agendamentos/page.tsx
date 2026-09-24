import Link from "next/link";
import { AppointmentActions } from "@/components/admin/appointment-actions";
import { NewAppointmentForm } from "@/components/admin/new-appointment-form";
import { Empty, PageTitle, StatusBadge } from "@/components/admin/ui";
import { listAppointmentDetails } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { addDaysISO, dateTimeLabel, isValidDateISO, isoAt, todayISO } from "@/lib/date";
import { STATUS_LABEL, formatDuration } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/types";

export const metadata = { title: "Agendamentos" };

type Search = Promise<{ status?: string; from?: string; to?: string; novo?: string; data?: string }>;

export default async function AppointmentsPage({ searchParams }: { searchParams: Search }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();

  const from = sp.from && isValidDateISO(sp.from) ? sp.from : today;
  const to = sp.to && isValidDateISO(sp.to) ? sp.to : addDaysISO(today, 60);
  const status = (["pending", "confirmed", "completed", "cancelled"] as const).includes(sp.status as AppointmentStatus) ? (sp.status as AppointmentStatus) : undefined;

  const [list, services, clients] = await Promise.all([
    listAppointmentDetails(db, { fromISO: isoAt(from, "00:00"), toISO: isoAt(addDaysISO(to, 1), "00:00"), status }),
    db.list("services", { eq: { active: true }, order: [["display_order", "asc"]] }),
    db.list("clients", { order: [["name", "asc"]] }),
  ]);

  return (
    <>
      <PageTitle title="Agendamentos" />

      <details className="mb-10 border border-linha px-5 py-4" open={sp.novo === "1"}>
        <summary className="cursor-pointer font-medium">Novo agendamento manual</summary>
        <div className="mt-5">
          {services.length ? <NewAppointmentForm services={services} clients={clients} defaultDate={sp.data && isValidDateISO(sp.data) ? sp.data : today} /> : <p className="text-cafe">Cadastre um serviço ativo antes.</p>}
        </div>
      </details>

      <form method="get" className="mb-6 grid gap-4 sm:grid-cols-[repeat(3,minmax(0,12rem))_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-[0.9rem] font-medium">Status</span>
          <select name="status" defaultValue={status ?? ""} className="field">
            <option value="">Todos</option>
            {(["pending", "confirmed", "completed", "cancelled"] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.9rem] font-medium">De</span>
          <input type="date" name="from" defaultValue={from} className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.9rem] font-medium">Até</span>
          <input type="date" name="to" defaultValue={to} className="field" />
        </label>
        <button type="submit" className="btn btn-sm btn-ghost">
          Filtrar
        </button>
      </form>

      {list.length === 0 ? (
        <Empty>Nenhum agendamento neste filtro.</Empty>
      ) : (
        <ul className="border-t border-linha">
          {list.map((a) => (
            <li key={a.id} className="grid gap-x-6 gap-y-2 border-b border-linha py-4 lg:grid-cols-[12rem_1fr_auto_auto] lg:items-center">
              <p className="tnum font-medium">{dateTimeLabel(a.starts_at)}</p>
              <div className="min-w-0">
                <Link href={`/admin/agendamentos/${a.id}`} className="link-draw">
                  {a.client?.name ?? "Cliente removido"}
                </Link>
                <p className="t-small truncate">
                  {a.service?.name ?? "Procedimento removido"} · {formatDuration(Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60_000))}
                  {a.source === "admin" ? " · manual" : ""}
                </p>
              </div>
              <StatusBadge status={a.status} />
              <AppointmentActions id={a.id} status={a.status} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
