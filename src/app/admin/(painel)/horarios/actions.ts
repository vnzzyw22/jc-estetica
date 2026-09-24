"use server";

import { bool, guarded, optStr, type ActionState } from "@/lib/admin-util";
import { hm, timeToMinutes } from "@/lib/date";
import type { AvailabilityRow } from "@/lib/types";

export async function saveAvailabilityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const rows: AvailabilityRow[] = [];

  for (let d = 0; d < 7; d++) {
    const isOpen = bool(fd, `open_${d}`);
    const open = hm(optStr(fd, `open_time_${d}`));
    const close = hm(optStr(fd, `close_time_${d}`));
    const bStart = hm(optStr(fd, `break_start_${d}`));
    const bEnd = hm(optStr(fd, `break_end_${d}`));

    if (isOpen) {
      if (!open || !close || timeToMinutes(close) <= timeToMinutes(open)) return { error: `Dia ${d === 0 ? "domingo" : d}: o fechamento precisa ser depois da abertura.` };
      if (Boolean(bStart) !== Boolean(bEnd)) return { error: "Preencha início e fim da pausa, ou deixe os dois vazios." };
      if (bStart && (timeToMinutes(bEnd) <= timeToMinutes(bStart) || timeToMinutes(bStart) < timeToMinutes(open) || timeToMinutes(bEnd) > timeToMinutes(close))) {
        return { error: "A pausa precisa estar dentro do expediente." };
      }
    }
    rows.push({
      weekday: d,
      is_open: isOpen,
      open_time: isOpen ? open : null,
      close_time: isOpen ? close : null,
      break_start: isOpen && bStart ? bStart : null,
      break_end: isOpen && bEnd ? bEnd : null,
    });
  }

  return guarded(async (db) => {
    for (const row of rows) await db.upsert("availability", row);
    return "Horários salvos.";
  }, ["/", "/agendamento", "/contato", "/admin/horarios"]);
}
