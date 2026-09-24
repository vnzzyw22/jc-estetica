import Link from "next/link";
import { PageTitle, StatusBadge } from "@/components/admin/ui";
import { listAppointmentDetails } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { addDaysISO, dateISOFromEpoch, dayLabel, isValidDateISO, isoAt, monthBounds, monthName, timeLabel, todayISO, weekdayOf, weekdayShort } from "@/lib/date";
import { BLOCK_KIND_LABEL } from "@/lib/format";
import type { AppointmentDetail, BlockedSlot } from "@/lib/types";

export const metadata = { title: "Agenda" };

type View = "day" | "week" | "month";
type Search = Promise<{ view?: string; date?: string }>;

const VIEW_LABEL: Record<View, string> = { day: "Dia", week: "Semana", month: "Mês" };

function rangeFor(view: View, date: string): { from: string; to: string } {
  if (view === "day") return { from: date, to: addDaysISO(date, 1) };
  if (view === "week") {
    const start = addDaysISO(date, -weekdayOf(date));
    return { from: start, to: addDaysISO(start, 7) };
  }
  const { first, last } = monthBounds(date.slice(0, 7));
  const start = addDaysISO(first, -weekdayOf(first));
  return { from: start, to: addDaysISO(addDaysISO(last, 6 - weekdayOf(last)), 1) };
}

function step(view: View, date: string, dir: 1 | -1): string {
  if (view === "day") return addDaysISO(date, dir);
  if (view === "week") return addDaysISO(date, 7 * dir);
  const [y, m] = date.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + dir, 1));
  return d.toISOString().slice(0, 10);
}

function blocksOnDay(blocks: BlockedSlot[], dateISO: string): BlockedSlot[] {
  const start = new Date(isoAt(dateISO, "00:00")).getTime();
  const end = new Date(isoAt(addDaysISO(dateISO, 1), "00:00")).getTime();
  return blocks.filter((b) => new Date(b.starts_at).getTime() < end && new Date(b.ends_at).getTime() > start);
}

function blockLabel(b: BlockedSlot, dateISO: string): string {
  const start = new Date(isoAt(dateISO, "00:00")).getTime();
  const end = new Date(isoAt(addDaysISO(dateISO, 1), "00:00")).getTime();
  const covers = new Date(b.starts_at).getTime() <= start && new Date(b.ends_at).getTime() >= end;
  const when = covers ? "Dia inteiro" : `${timeLabel(new Date(Math.max(new Date(b.starts_at).getTime(), start)).toISOString())}–${timeLabel(new Date(Math.min(new Date(b.ends_at).getTime(), end)).toISOString())}`;
  return `${BLOCK_KIND_LABEL[b.kind]} · ${when}${b.reason ? ` · ${b.reason}` : ""}`;
}

function DayItems({ dateISO, appts, blocks, compact }: { dateISO: string; appts: AppointmentDetail[]; blocks: BlockedSlot[]; compact?: boolean }) {
  const dayAppts = appts.filter((a) => dateISOFromEpoch(new Date(a.starts_at).getTime()) === dateISO && a.status !== "cancelled");
  const dayBlocks = blocksOnDay(blocks, dateISO);
  if (!dayAppts.length && !dayBlocks.length) return <p className="t-small">{compact ? "—" : "Sem atendimentos neste dia."}</p>;
  return (
    <ul className="space-y-2">
      {dayBlocks.map((b) => (
        <li key={b.id} className="border border-dashed border-linha px-2 py-1.5 text-[0.8125rem] text-cafe">
          {blockLabel(b, dateISO)}
        </li>
      ))}
      {dayAppts.map((a) => (
        <li key={a.id}>
          <Link href={`/admin/agendamentos/${a.id}`} className="block border-l-2 border-bisturi bg-seda/70 px-2 py-1.5 text-[0.875rem] transition-colors hover:bg-seda">
            <span className="tnum font-medium">{timeLabel(a.starts_at)}</span> {a.client?.name ?? "—"}
            {!compact && (
              <span className="t-small flex flex-wrap items-center gap-x-3">
                {a.service?.name} <StatusBadge status={a.status} />
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function AgendaPage({ searchParams }: { searchParams: Search }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const view: View = sp.view === "week" || sp.view === "month" ? sp.view : "day";
  const date = sp.date && isValidDateISO(sp.date) ? sp.date : today;

  const { from, to } = rangeFor(view, date);
  const [appts, allBlocks] = await Promise.all([
    listAppointmentDetails(db, { fromISO: isoAt(from, "00:00"), toISO: isoAt(to, "00:00") }),
    db.list("blocked_slots", { lt: { starts_at: isoAt(to, "00:00") } }),
  ]);
  const blocks = allBlocks.filter((b) => new Date(b.ends_at).getTime() > new Date(isoAt(from, "00:00")).getTime());

  const link = (v: View, d: string) => `/admin/agenda?view=${v}&date=${d}`;
  const title = view === "month" ? `${monthName(Number(date.slice(5, 7)) - 1)} ${date.slice(0, 4)}` : view === "week" ? `${dayLabel(from, "short")} a ${dayLabel(addDaysISO(to, -1), "short")}` : dayLabel(date);
  const days = Array.from({ length: (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000 }, (_, i) => addDaysISO(from, i));

  return (
    <>
      <PageTitle title="Agenda">
        <Link href={`/admin/agendamentos?novo=1&data=${date}`} className="btn btn-sm">
          Novo agendamento
        </Link>
        <Link href={`/admin/bloqueios?data=${date}`} className="btn btn-sm btn-ghost">
          Bloquear horário
        </Link>
      </PageTitle>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link href={link(view, step(view, date, -1))} className="btn btn-sm btn-ghost" aria-label="Anterior">
            ‹
          </Link>
          <Link href={link(view, today)} className="btn btn-sm btn-ghost">
            Hoje
          </Link>
          <Link href={link(view, step(view, date, 1))} className="btn btn-sm btn-ghost" aria-label="Próximo">
            ›
          </Link>
          <p className="ml-3 font-serif text-[1.4rem] font-light capitalize">{title}</p>
        </div>
        <div role="group" aria-label="Visualização" className="flex gap-4">
          {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
            <Link key={v} href={link(v, date)} aria-current={v === view ? "true" : undefined} className={`link-draw min-h-9 ${v === view ? "font-medium text-bisturi" : "text-cafe"}`}>
              {VIEW_LABEL[v]}
            </Link>
          ))}
        </div>
      </div>

      {view === "day" && <DayItems dateISO={date} appts={appts} blocks={blocks} />}

      {view === "week" && (
        <div className="grid gap-x-3 gap-y-6 md:grid-cols-7">
          {days.map((d) => (
            <section key={d} aria-label={dayLabel(d)} className="min-w-0 border-t border-espresso pt-2">
              <Link href={link("day", d)} className={`link-draw mb-2 text-[0.875rem] ${d === today ? "font-medium text-bisturi" : ""}`}>
                {dayLabel(d, "short")}
              </Link>
              <DayItems dateISO={d} appts={appts} blocks={blocks} compact />
            </section>
          ))}
        </div>
      )}

      {view === "month" && (
        <div className="grid grid-cols-7 border-l border-t border-linha">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="t-small border-b border-r border-linha px-2 py-1.5 text-center">
              {weekdayShort(i)}
            </div>
          ))}
          {days.map((d) => {
            const inMonth = d.slice(0, 7) === date.slice(0, 7);
            const count = appts.filter((a) => a.status !== "cancelled" && dateISOFromEpoch(new Date(a.starts_at).getTime()) === d).length;
            const blocked = blocksOnDay(blocks, d).length > 0;
            return (
              <Link
                key={d}
                href={link("day", d)}
                aria-label={`${dayLabel(d)}: ${count} atendimento${count === 1 ? "" : "s"}${blocked ? ", com bloqueio" : ""}`}
                className={`tnum min-h-20 border-b border-r border-linha p-2 transition-colors hover:bg-seda/70 ${inMonth ? "" : "text-cafe/40"} ${d === today ? "bg-seda" : ""}`}
              >
                <span className="text-[0.9rem]">{Number(d.slice(8))}</span>
                {count > 0 && <span className="mt-1 block text-[0.8125rem] text-bisturi">{count} atend.</span>}
                {blocked && <span className="block text-[0.75rem] text-cafe">bloqueio</span>}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
