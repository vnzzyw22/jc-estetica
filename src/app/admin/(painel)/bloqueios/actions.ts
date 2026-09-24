"use server";

import { guarded, optStr, str, type ActionState } from "@/lib/admin-util";
import { addDaysISO, isValidDateISO, isoAt } from "@/lib/date";
import type { BlockKind } from "@/lib/types";

const KINDS: BlockKind[] = ["block", "day_off", "vacation", "holiday", "personal"];
const PATHS = ["/agendamento", "/admin/bloqueios", "/admin/agenda", "/admin/dashboard"];

export async function createBlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const kind = str(fd, "kind") as BlockKind;
  if (!KINDS.includes(kind)) return { error: "Tipo inválido." };
  const startDate = str(fd, "start_date");
  const endDate = str(fd, "end_date") || startDate;
  if (!isValidDateISO(startDate) || !isValidDateISO(endDate)) return { error: "Informe as datas." };
  if (endDate < startDate) return { error: "A data final não pode ser antes da inicial." };

  const wholeDays = str(fd, "scope") === "days";
  let startISO: string;
  let endISO: string;
  if (wholeDays) {
    startISO = isoAt(startDate, "00:00");
    endISO = isoAt(addDaysISO(endDate, 1), "00:00");
  } else {
    const startTime = str(fd, "start_time");
    const endTime = str(fd, "end_time");
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return { error: "Informe o horário inicial e o final." };
    startISO = isoAt(startDate, startTime);
    endISO = isoAt(endDate, endTime);
    if (new Date(endISO) <= new Date(startISO)) return { error: "O fim precisa ser depois do início." };
  }

  return guarded(async (db) => {
    await db.insert("blocked_slots", { starts_at: startISO, ends_at: endISO, kind, reason: optStr(fd, "reason") });
    const clashing = (await db.list("appointments", { lt: { starts_at: endISO } })).filter(
      (a) => a.status !== "cancelled" && new Date(a.ends_at) > new Date(startISO),
    );
    return clashing.length
      ? `Bloqueio criado. Atenção: já existe(m) ${clashing.length} agendamento(s) nesse período — reveja-os na Agenda.`
      : "Bloqueio criado.";
  }, PATHS);
}

export async function deleteBlockAction(fd: FormData): Promise<void> {
  await guarded((db) => db.remove("blocked_slots", str(fd, "id")), PATHS);
}
