import type { Db } from "@/lib/data/db";
import { DbError } from "@/lib/data/db";
import { isoAt } from "@/lib/date";
import { digitsOnly } from "@/lib/format";
import type { AppointmentDetail, AppointmentStatus } from "@/lib/types";

interface ListOptions {
  fromISO?: string;
  toISO?: string;
  status?: AppointmentStatus;
}

/** Agendamentos com cliente e serviço embutidos, ordenados por horário. */
export async function listAppointmentDetails(db: Db, { fromISO, toISO, status }: ListOptions = {}): Promise<AppointmentDetail[]> {
  const [appointments, clients, services] = await Promise.all([
    db.list("appointments", {
      ...(status ? { eq: { status } } : {}),
      ...(fromISO ? { gte: { starts_at: fromISO } } : {}),
      ...(toISO ? { lt: { starts_at: toISO } } : {}),
      order: [["starts_at", "asc"]],
    }),
    db.list("clients"),
    db.list("services"),
  ]);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const serviceById = new Map(services.map((s) => [s.id, s]));
  return appointments.map((a) => ({ ...a, client: clientById.get(a.client_id) ?? null, service: serviceById.get(a.service_id) ?? null }));
}

async function assertNotBlocked(db: Db, startISO: string, endISO: string): Promise<void> {
  const blocks = await db.list("blocked_slots", { lt: { starts_at: endISO } });
  if (blocks.some((b) => new Date(b.ends_at).getTime() > new Date(startISO).getTime())) throw new DbError("blocked");
}

interface ManualAppointment {
  clientId?: string | null;
  name?: string;
  phone?: string;
  email?: string | null;
  serviceId: string;
  dateISO: string;
  time: string;
  status: AppointmentStatus;
  notes?: string | null;
}

/** Cria agendamento pelo painel: reutiliza cliente por telefone, checa bloqueios; o banco barra conflitos. */
export async function createManualAppointment(db: Db, input: ManualAppointment): Promise<string> {
  const service = await db.get("services", input.serviceId);
  if (!service) throw new DbError("service_not_found");

  let clientId = input.clientId ?? null;
  if (!clientId) {
    const phone = digitsOnly(input.phone ?? "");
    if (!input.name || input.name.length < 2) throw new DbError("invalid_name");
    if (phone.length < 10 || phone.length > 13) throw new DbError("invalid_phone");
    const [existing] = await db.list("clients", { eq: { phone }, limit: 1 });
    clientId = existing
      ? existing.id
      : (await db.insert("clients", { name: input.name, phone, email: input.email ?? null, notes: null })).id;
  }

  const startISO = isoAt(input.dateISO, input.time);
  const endISO = new Date(new Date(startISO).getTime() + service.duration_minutes * 60_000).toISOString();
  await assertNotBlocked(db, startISO, endISO);

  const created = await db.insert("appointments", {
    client_id: clientId,
    service_id: service.id,
    starts_at: startISO,
    ends_at: endISO,
    status: input.status,
    source: "admin",
    notes: input.notes ?? null,
  });
  return created.id;
}

export async function rescheduleAppointment(db: Db, id: string, dateISO: string, time: string): Promise<void> {
  const appt = await db.get("appointments", id);
  if (!appt) throw new DbError("not_found", "Agendamento não encontrado.");
  const duration = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
  const startISO = isoAt(dateISO, time);
  const endISO = new Date(new Date(startISO).getTime() + duration).toISOString();
  await assertNotBlocked(db, startISO, endISO);
  await db.update("appointments", id, { starts_at: startISO, ends_at: endISO });
}
