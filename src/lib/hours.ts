import type { AvailabilityRow } from "@/lib/types";
import { hm, weekdayShort } from "@/lib/date";

function hourLabel(time: string): string {
  const [h, m] = hm(time).split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/** Resume o expediente em linhas legíveis: "seg a sex — 9h às 18h". Dias fechados são omitidos. */
export function summarizeHours(rows: AvailabilityRow[]): Array<{ days: string; hours: string }> {
  // Segunda → domingo, para agrupar dias consecutivos na ordem natural da semana.
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((d) => rows.find((r) => r.weekday === d)).filter((r): r is AvailabilityRow => Boolean(r));

  const groups: Array<{ first: number; last: number; hours: string }> = [];
  ordered.forEach((row, idx) => {
    if (!row.is_open || !row.open_time || !row.close_time) return;
    const hours = `${hourLabel(row.open_time)} às ${hourLabel(row.close_time)}`;
    const prev = groups[groups.length - 1];
    if (prev && prev.hours === hours && prev.last === idx - 1) prev.last = idx;
    else groups.push({ first: idx, last: idx, hours });
  });

  return groups.map((g) => ({
    days:
      g.first === g.last
        ? weekdayShort(ordered[g.first].weekday)
        : `${weekdayShort(ordered[g.first].weekday)} a ${weekdayShort(ordered[g.last].weekday)}`,
    hours: g.hours,
  }));
}
