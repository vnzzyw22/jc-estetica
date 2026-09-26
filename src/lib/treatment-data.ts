import type { Db } from "@/lib/data/db";
import { sessionProgress, type Progress } from "@/lib/treatment";
import type { Appointment, Client, Evolution, Payment, Service, Treatment, TreatmentPackage, TreatmentSession } from "@/lib/types";

// Carregadores de tratamentos. As regras (o que cada estado permite, progresso) são de treatment.ts.

export interface SessionView extends TreatmentSession {
  service: Service | null;
  appointment: Appointment | null;
}

export interface TreatmentDetail {
  treatment: Treatment;
  client: Client | null;
  pkg: TreatmentPackage | null;
  sessions: SessionView[];
  evolutions: Evolution[];
  payments: Payment[];
  /** Todos os serviços (inclusive inativos), para nomear as sessões; a lista para escolher filtra os ativos. */
  services: Service[];
  progress: Progress;
}

/** Tudo o que a página de um tratamento precisa, numa passada. */
export async function loadTreatmentDetail(db: Db, id: string): Promise<TreatmentDetail | null> {
  const treatment = await db.get("treatments", id).catch(() => null);
  if (!treatment) return null;

  const [client, pkg, sessions, evolutions, payments, services, appointments] = await Promise.all([
    db.get("clients", treatment.client_id),
    treatment.package_id ? db.get("treatment_packages", treatment.package_id) : null,
    db.list("treatment_sessions", { eq: { treatment_id: id }, order: [["number", "asc"]] }),
    db.list("evolutions", { eq: { treatment_id: id }, order: [["recorded_at", "desc"]] }),
    db.list("payments", { eq: { treatment_id: id } }),
    db.list("services", { order: [["display_order", "asc"]] }),
    db.list("appointments", { eq: { client_id: treatment.client_id, kind: "session" } }),
  ]);

  const serviceById = new Map(services.map((s) => [s.id, s]));
  const appointmentById = new Map(appointments.map((a) => [a.id, a]));
  const views: SessionView[] = sessions.map((s) => ({
    ...s,
    service: s.service_id ? (serviceById.get(s.service_id) ?? null) : null,
    appointment: s.appointment_id ? (appointmentById.get(s.appointment_id) ?? null) : null,
  }));

  return { treatment, client, pkg, sessions: views, evolutions, payments, services, progress: sessionProgress(sessions) };
}

export interface TreatmentOverviewRow {
  treatment: Treatment;
  client: Client | null;
  progress: Progress;
  /** Início da sessão em aberto com horário mais cedo (ISO). Pode já ter passado. */
  nextAt: string | null;
  /** Sessões em aberto cujo horário já passou sem serem marcadas como realizadas. */
  pastOpen: number;
}

/** Lista geral: cada tratamento com progresso e a próxima sessão com horário (mesmo que o horário já tenha passado sem a sessão ser concluída). */
export async function loadTreatmentOverview(db: Db, nowMs: number): Promise<TreatmentOverviewRow[]> {
  const [treatments, clients, sessions, upcoming] = await Promise.all([
    db.list("treatments", { order: [["proposed_at", "desc"]] }),
    db.list("clients"),
    db.list("treatment_sessions"),
    db.list("appointments", { eq: { kind: "session" } }),
  ]);

  const clientById = new Map(clients.map((c) => [c.id, c]));
  // Só horários ainda em aberto: o que foi concluído ou cancelado não é "próxima sessão".
  const startById = new Map(upcoming.filter((a) => a.status === "pending" || a.status === "confirmed").map((a) => [a.id, a.starts_at]));
  const byTreatment = new Map<string, TreatmentSession[]>();
  for (const s of sessions) byTreatment.set(s.treatment_id, [...(byTreatment.get(s.treatment_id) ?? []), s]);

  return treatments.map((t) => {
    const list = byTreatment.get(t.id) ?? [];
    const starts = list.map((s) => (s.appointment_id ? startById.get(s.appointment_id) : undefined)).filter((x): x is string => Boolean(x)).sort();
    const pastOpen = starts.filter((s) => Date.parse(s) < nowMs).length;
    return { treatment: t, client: clientById.get(t.client_id) ?? null, progress: sessionProgress(list), nextAt: starts[0] ?? null, pastOpen };
  });
}
