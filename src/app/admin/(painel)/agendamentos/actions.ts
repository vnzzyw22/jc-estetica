"use server";

import { redirect } from "next/navigation";
import { guarded, optStr, str, type ActionState } from "@/lib/admin-util";
import { createManualAppointment, rescheduleAppointment } from "@/lib/admin-data";
import { isValidDateISO } from "@/lib/date";
import type { AppointmentStatus } from "@/lib/types";

const STATUSES: AppointmentStatus[] = ["pending", "confirmed", "completed", "cancelled"];
const PATHS = ["/admin/agendamentos", "/admin/agenda", "/admin/dashboard", "/admin/clientes"];

export async function createAppointmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const dateISO = str(fd, "date");
  const time = str(fd, "time");
  if (!isValidDateISO(dateISO) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Informe data e horário." };
  const status = str(fd, "status") as AppointmentStatus;
  if (!STATUSES.includes(status)) return { error: "Status inválido." };

  return guarded(async (db) => {
    await createManualAppointment(db, {
      clientId: optStr(fd, "client_id"),
      name: str(fd, "name"),
      phone: str(fd, "phone"),
      email: optStr(fd, "email"),
      serviceId: str(fd, "service_id"),
      dateISO,
      time,
      status,
      notes: optStr(fd, "notes"),
    });
    return "Agendamento criado.";
  }, PATHS);
}

/** Troca de status a partir de botões de linha (formulário simples). */
export async function setStatusAction(fd: FormData): Promise<void> {
  const status = str(fd, "status") as AppointmentStatus;
  if (!STATUSES.includes(status)) return;
  await guarded((db) => db.update("appointments", str(fd, "id"), { status }).then(() => undefined), PATHS);
}

export async function deleteAppointmentAction(fd: FormData): Promise<void> {
  await guarded((db) => db.remove("appointments", str(fd, "id")), PATHS);
  if (str(fd, "redirect") === "list") redirect("/admin/agendamentos");
}

export async function rescheduleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const dateISO = str(fd, "date");
  const time = str(fd, "time");
  if (!isValidDateISO(dateISO) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Informe data e horário." };
  return guarded(async (db) => {
    await rescheduleAppointment(db, str(fd, "id"), dateISO, time);
    return "Horário remarcado.";
  }, PATHS);
}

export async function saveNotesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async (db) => {
    await db.update("appointments", str(fd, "id"), { notes: optStr(fd, "notes") });
  }, PATHS);
}
