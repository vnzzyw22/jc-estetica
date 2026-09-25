import type { Db } from "@/lib/data/db";
import { clientStage, type ClientStage } from "@/lib/client-stage";
import { KIND_LABEL, STATUS_LABEL } from "@/lib/format";
import { SOURCE_LABEL, labels } from "@/lib/screening";
import type { Anamnesis, AppointmentDetail, Client, Screening, Service, Treatment } from "@/lib/types";

export type TimelineKind = "cadastro" | "triagem" | "anamnese" | "agenda" | "tratamento";

export interface TimelineItem {
  at: string;
  kind: TimelineKind;
  title: string;
  detail?: string;
  href?: string;
  /** Evento ainda por acontecer (agendamento futuro). */
  upcoming?: boolean;
}

export interface ClientFile {
  client: Client;
  stage: ClientStage;
  screenings: Screening[];
  anamneses: Anamnesis[];
  appointments: AppointmentDetail[];
  treatments: Treatment[];
  timeline: TimelineItem[];
}

const TAB_HREF = (id: string, tab: string, extra = "") => `/admin/clientes/${id}?aba=${tab}${extra}`;

export function buildTimeline(f: Omit<ClientFile, "timeline" | "stage">, now: number): TimelineItem[] {
  const items: TimelineItem[] = [{ at: f.client.created_at, kind: "cadastro", title: "Cadastro da cliente" }];

  for (const s of f.screenings) {
    items.push({
      at: s.created_at,
      kind: "triagem",
      title: "Triagem enviada",
      detail: [`Origem: ${SOURCE_LABEL[s.source] ?? s.source}`, labels.goal(s.goal)].filter(Boolean).join(", "),
      href: TAB_HREF(f.client.id, "triagem"),
    });
  }

  for (const a of f.anamneses) {
    items.push({ at: a.created_at, kind: "anamnese", title: a.status === "draft" ? "Anamnese iniciada" : "Anamnese registrada", href: TAB_HREF(f.client.id, "anamnese", `&id=${a.id}`) });
  }

  for (const ap of f.appointments) {
    const when = new Date(ap.starts_at).getTime();
    items.push({
      at: ap.starts_at,
      kind: "agenda",
      title: ap.service?.name ?? KIND_LABEL[ap.kind],
      detail: [ap.service ? KIND_LABEL[ap.kind] : null, STATUS_LABEL[ap.status].toLowerCase()].filter(Boolean).join(", "),
      href: `/admin/agendamentos/${ap.id}`,
      upcoming: when > now && ap.status !== "cancelled",
    });
  }

  for (const t of f.treatments) {
    items.push({ at: t.proposed_at, kind: "tratamento", title: `Tratamento proposto: ${t.name}` });
    if (t.started_at) items.push({ at: t.started_at, kind: "tratamento", title: `Tratamento iniciado: ${t.name}` });
    if (t.completed_at) items.push({ at: t.completed_at, kind: "tratamento", title: `Tratamento concluído: ${t.name}` });
  }

  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Tudo o que a ficha precisa da cliente, numa passada. */
export async function loadClientFile(db: Db, id: string, now: number = Date.now()): Promise<ClientFile | null> {
  const client = await db.get("clients", id);
  if (!client) return null;

  const [screenings, anamneses, appts, treatments, services] = await Promise.all([
    db.list("screenings", { eq: { client_id: id }, order: [["created_at", "desc"]] }),
    db.list("anamneses", { eq: { client_id: id }, order: [["created_at", "desc"]] }),
    db.list("appointments", { eq: { client_id: id }, order: [["starts_at", "desc"]] }),
    db.list("treatments", { eq: { client_id: id }, order: [["proposed_at", "desc"]] }),
    db.list("services"),
  ]);

  const serviceById = new Map<string, Service>(services.map((s) => [s.id, s]));
  const appointments: AppointmentDetail[] = appts.map((a) => ({ ...a, client, service: a.service_id ? (serviceById.get(a.service_id) ?? null) : null }));

  const base = { client, screenings, anamneses, appointments, treatments };
  return { ...base, stage: clientStage({ screenings, treatments, appointments }), timeline: buildTimeline(base, now) };
}
