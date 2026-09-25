"use server";

import { createManualAppointment } from "@/lib/admin-data";
import { guarded, optStr, str, type ActionState } from "@/lib/admin-util";
import { isValidDateISO } from "@/lib/date";
import { SCREENING_STATUS } from "@/lib/screening";
import type { ScreeningStatus } from "@/lib/types";

const PATHS = ["/admin/triagens", "/admin/dashboard", "/admin/agenda", "/admin/agendamentos"];

export async function updateScreeningAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const status = str(fd, "status") as ScreeningStatus;
  if (!SCREENING_STATUS.some((s) => s.value === status)) return { error: "Estado inválido." };
  const notes = optStr(fd, "internal_notes");
  if (notes && notes.length > 4000) return { error: "As observações passaram de 4000 caracteres." };

  return guarded(async (db) => {
    await db.update("screenings", str(fd, "id"), { status, internal_notes: notes });
    return "Triagem atualizada.";
  }, PATHS);
}

/** Agenda a avaliação ligada à triagem. O banco move o estado do lead para "avaliação agendada". */
export async function scheduleEvaluationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const dateISO = str(fd, "date");
  const time = str(fd, "time");
  if (!isValidDateISO(dateISO) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Informe data e horário." };

  return guarded(async (db) => {
    const screening = await db.get("screenings", str(fd, "id"));
    if (!screening) throw new Error("triagem não encontrada");
    await createManualAppointment(db, {
      clientId: screening.client_id,
      screeningId: screening.id,
      serviceId: null,
      kind: "evaluation",
      dateISO,
      time,
      status: "confirmed",
      notes: optStr(fd, "notes"),
    });
    return "Avaliação agendada.";
  }, PATHS);
}
