import type { AvailabilityRow, BookingErrorCode, BusyRange, Settings } from "@/lib/types";
import { addDaysISO, dateISOFromEpoch, epochAt, hm, timeLabel, todayISO, weekdayOf } from "@/lib/date";

export interface SlotContext {
  settings: Settings;
  availability: AvailabilityRow[];
  busy: BusyRange[];
  nowMs?: number;
}

function windowsFor(dateISO: string, availability: AvailabilityRow[]): Array<[number, number]> {
  const row = availability.find((a) => a.weekday === weekdayOf(dateISO));
  if (!row || !row.is_open || !row.open_time || !row.close_time) return [];
  const open = epochAt(dateISO, row.open_time);
  const close = epochAt(dateISO, row.close_time);
  if (row.break_start && row.break_end) {
    return [
      [open, epochAt(dateISO, row.break_start)],
      [epochAt(dateISO, row.break_end), close],
    ];
  }
  return [[open, close]];
}

function overlapsBusy(start: number, end: number, busy: BusyRange[], bufferMs: number): boolean {
  return busy.some((b) => {
    const bs = new Date(b.starts_at).getTime();
    const be = new Date(b.ends_at).getTime();
    return start < be + bufferMs && end + bufferMs > bs;
  });
}

/** Horários de início livres ("HH:MM") de um dia para um serviço. */
export function slotsForDay(dateISO: string, durationMinutes: number, ctx: SlotContext): string[] {
  const { settings, availability, busy } = ctx;
  const now = ctx.nowMs ?? Date.now();
  const earliest = now + settings.min_notice_hours * 3_600_000;
  const latest = now + settings.max_days_ahead * 86_400_000;
  const stepMs = settings.slot_interval_minutes * 60_000;
  const durMs = durationMinutes * 60_000;
  const bufferMs = settings.buffer_minutes * 60_000;

  const slots: string[] = [];
  for (const [ws, we] of windowsFor(dateISO, availability)) {
    for (let start = ws; start + durMs <= we; start += stepMs) {
      if (start < earliest || start > latest) continue;
      if (overlapsBusy(start, start + durMs, busy, bufferMs)) continue;
      slots.push(hm(timeLabel(new Date(start).toISOString())));
    }
  }
  return slots;
}

/** Datas do intervalo [fromISO, toISO] com ao menos um horário livre. */
export function availableDays(fromISO: string, toISO: string, durationMinutes: number, ctx: SlotContext): string[] {
  const days: string[] = [];
  for (let d = fromISO; d <= toISO; d = addDaysISO(d, 1)) {
    if (slotsForDay(d, durationMinutes, ctx).length > 0) days.push(d);
  }
  return days;
}

/** Primeiro horário livre a partir de hoje (até max_days_ahead). */
export function nextFreeSlot(durationMinutes: number, ctx: SlotContext): { dateISO: string; time: string } | null {
  const now = ctx.nowMs ?? Date.now();
  const end = dateISOFromEpoch(now + ctx.settings.max_days_ahead * 86_400_000);
  for (let d = todayISO(now); d <= end; d = addDaysISO(d, 1)) {
    const slots = slotsForDay(d, durationMinutes, ctx);
    if (slots.length) return { dateISO: d, time: slots[0] };
  }
  return null;
}

/**
 * Espelha as regras de create_booking (SQL) — usado pelo modo local e para
 * validar antes de gravar. `blocked` são só os bloqueios (não os agendamentos).
 */
export function validateSlot(
  dateISO: string,
  time: string,
  durationMinutes: number,
  blocked: BusyRange[],
  ctx: SlotContext,
): BookingErrorCode | null {
  const now = ctx.nowMs ?? Date.now();
  const start = epochAt(dateISO, time);
  const end = start + durationMinutes * 60_000;
  if (start < now + ctx.settings.min_notice_hours * 3_600_000) return "too_soon";
  if (start > now + ctx.settings.max_days_ahead * 86_400_000) return "too_far";
  const inWindow = windowsFor(dateISO, ctx.availability).some(([ws, we]) => start >= ws && end <= we);
  if (!inWindow) return "outside_hours";
  if (blocked.some((b) => start < new Date(b.ends_at).getTime() && end > new Date(b.starts_at).getTime())) return "blocked";
  return null;
}
