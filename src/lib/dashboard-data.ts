import { listAppointmentDetails } from "@/lib/admin-data";
import type { Db } from "@/lib/data/db";
import { attentionItems, partitionByDay } from "@/lib/dashboard";
import { addDaysISO, dateISOFromEpoch, isoAt, todayISO } from "@/lib/date";
import { overdueRows, totalsOf } from "@/lib/finance";
import { loadMonthFlow, loadOverdueFlow } from "@/lib/finance-data";
import { loadTreatmentOverview } from "@/lib/treatment-data";

/** Tudo o que o dashboard mostra, carregado em paralelo e numa passada só pela agenda. */
export async function loadDashboard(db: Db, nowMs: number) {
  const today = todayISO(nowMs);
  const month = today.slice(0, 7);
  const lastDay = addDaysISO(today, 14);

  const [agenda, pending, newScreenings, treatments, monthFlow, overdueFlow] = await Promise.all([
    listAppointmentDetails(db, { fromISO: isoAt(today, "00:00"), toISO: isoAt(addDaysISO(today, 15), "00:00") }),
    db.list("appointments", { eq: { status: "pending" }, gte: { starts_at: new Date(nowMs).toISOString() } }),
    db.list("screenings", { eq: { status: "new" } }),
    loadTreatmentOverview(db, nowMs),
    loadMonthFlow(db, month),
    loadOverdueFlow(db, today),
  ]);

  const active = agenda.filter((a) => a.status !== "cancelled");
  const dayOf = (a: (typeof active)[number]) => dateISOFromEpoch(Date.parse(a.starts_at));
  const { today: todayList, later } = partitionByDay(active, dayOf, today, lastDay);
  const weekEnd = addDaysISO(today, 6);
  const weekCount = todayList.length + later.filter((a) => dayOf(a) <= weekEnd).length;

  const inProgress = treatments.filter((r) => r.treatment.status === "active");
  const lateIn = totalsOf(overdueRows(overdueFlow, today, "in"));
  const lateOut = totalsOf(overdueRows(overdueFlow, today, "out"));
  const lateInCount = overdueRows(overdueFlow, today, "in").length;
  const lateOutCount = overdueRows(overdueFlow, today, "out").length;

  const attention = attentionItems({
    newScreenings: newScreenings.length,
    pendingAppointments: pending.length,
    sessionsToClose: inProgress.reduce((sum, r) => sum + r.pastOpen, 0),
    activeWithoutNext: inProgress.filter((r) => r.nextAt === null && r.progress.toSchedule > 0).length,
    overdueReceivable: { count: lateInCount, total: lateIn.toReceive },
    overdueExpense: { count: lateOutCount, total: lateOut.toPay },
  });

  return {
    today,
    month,
    attention,
    todayList,
    upcoming: later.slice(0, 8),
    weekCount,
    money: totalsOf(monthFlow),
    // Em andamento: quem tem sessão marcada mais cedo primeiro; sem sessão marcada por último.
    inProgress: [...inProgress].sort((a, b) => (a.nextAt ?? "9").localeCompare(b.nextAt ?? "9")),
  };
}
