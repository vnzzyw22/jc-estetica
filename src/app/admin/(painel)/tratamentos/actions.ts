"use server";

import { redirect } from "next/navigation";
import { guarded, optStr, str, type ActionState } from "@/lib/admin-util";
import { DbError } from "@/lib/data/db";
import { isValidDateISO, isoAt } from "@/lib/date";
import { parseMoney } from "@/lib/finance";
import { backTo, withParam } from "@/lib/flash";
import { validateEvolution, validateTreatment } from "@/lib/treatment";
import type { Treatment } from "@/lib/types";

const PATHS = ["/admin/tratamentos", "/admin/clientes", "/admin/agenda", "/admin/agendamentos", "/admin/triagens", "/admin/financeiro", "/admin/dashboard"];
const here = (id: string) => `/admin/tratamentos/${id}`;

/** Dinheiro do formulário: vazio → null; ilegível → NaN (o validador recusa). */
function money(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (!raw) return null;
  return parseMoney(raw) ?? Number.NaN;
}

function treatmentInput(fd: FormData, defaults: Partial<Treatment> = {}) {
  return {
    name: str(fd, "name") || defaults.name,
    goal: str(fd, "goal"),
    total_sessions: str(fd, "total_sessions") || defaults.total_sessions,
    interval_days: str(fd, "interval_days"),
    frequency_note: str(fd, "frequency_note"),
    billing_mode: str(fd, "billing_mode") || defaults.billing_mode,
    price_total: money(fd, "price_total"),
    session_price: money(fd, "session_price"),
    valid_until: str(fd, "valid_until"),
    notes: str(fd, "notes"),
  };
}

// ---------------------------------------------------------------------------
// Criar, iniciar, pausar, cancelar, excluir
// ---------------------------------------------------------------------------

/** Propõe um tratamento: a partir de um pacote do catálogo ou personalizado. Vai para a página dele. */
export async function createTreatmentAction(fd: FormData): Promise<void> {
  const clientId = str(fd, "client_id");
  const back = backTo(str(fd, "back"), `/admin/clientes/${clientId}?aba=tratamentos`);
  if (!clientId) redirect(withParam(back, "erro", "Cliente não informada."));

  const packageId = str(fd, "package_id");
  const screeningId = optStr(fd, "screening_id");
  let createdId = "";
  let res;

  if (packageId && packageId !== "personalizado") {
    res = await guarded(async (db) => {
      createdId = await db.rpc<string>("create_treatment_from_package", { p_client_id: clientId, p_package_id: packageId, p_screening_id: screeningId });
    }, PATHS);
  } else {
    const parsed = validateTreatment(treatmentInput(fd));
    if (!parsed.ok) redirect(withParam(back, "erro", Object.values(parsed.errors).join(" ")));
    res = await guarded(async (db) => {
      createdId = (await db.insert("treatments", { client_id: clientId, screening_id: screeningId, ...parsed.value })).id;
      // A função do pacote já faz isto; no tratamento personalizado, a triagem avança aqui.
      if (screeningId) {
        const screening = await db.get("screenings", screeningId);
        if (screening && ["new", "in_review", "evaluation_scheduled", "evaluated"].includes(screening.status)) await db.update("screenings", screeningId, { status: "treatment_proposed" });
      }
    }, PATHS);
  }

  if (res?.error) redirect(withParam(back, "erro", res.error));
  redirect(withParam(here(createdId), "aviso", "Tratamento proposto. Revise os dados e inicie quando estiver combinado."));
}

/** Inicia (gera as sessões a agendar) ou retoma um tratamento pausado. */
export async function startTreatmentAction(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  let created = 0;
  const res = await guarded(async (db) => {
    created = await db.rpc<number>("activate_treatment", { p_treatment_id: id });
  }, PATHS);
  if (res?.error) redirect(withParam(here(id), "erro", res.error));
  redirect(withParam(here(id), "aviso", created > 0 ? `Tratamento iniciado: ${created} sessões geradas para agendar.` : "Tratamento retomado."));
}

export async function pauseTreatmentAction(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  const res = await guarded((db) => db.rpc("pause_treatment", { p_treatment_id: id }).then(() => undefined), PATHS);
  redirect(withParam(here(id), res?.error ? "erro" : "aviso", res?.error ?? "Tratamento pausado. Os horários já marcados continuam na agenda."));
}

/** Cancela o tratamento, as sessões em aberto e os horários delas. Cobranças ficam como estão. */
export async function cancelTreatmentAction(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  let closed = 0;
  const res = await guarded(async (db) => {
    closed = await db.rpc<number>("cancel_treatment", { p_treatment_id: id });
  }, PATHS);
  const done = `Tratamento cancelado. ${closed} ${closed === 1 ? "sessão em aberto foi cancelada" : "sessões em aberto foram canceladas"} e os horários voltaram a ficar livres. Se houver cobranças, decida o que fazer com elas no Financeiro.`;
  redirect(withParam(here(id), res?.error ? "erro" : "aviso", res?.error ?? done));
}

/** Só tratamento proposto, sem cobranças (o banco protege o histórico). */
export async function deleteTreatmentAction(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  const back = backTo(str(fd, "back"), "/admin/tratamentos");
  const res = await guarded(async (db) => {
    const t = await db.get("treatments", id);
    if (!t) return;
    if (t.status !== "proposed") throw new DbError("invalid_status");
    await db.remove("treatments", id);
  }, PATHS);
  redirect(res?.error ? withParam(here(id), "erro", res.error) : withParam(back, "aviso", "Tratamento excluído."));
}

/** Edita. Sessões e forma de cobrança só mudam enquanto o tratamento é uma proposta. */
export async function updateTreatmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  return guarded(async (db) => {
    const current = await db.get("treatments", id);
    if (!current) throw new DbError("treatment_not_found");
    const proposed = current.status === "proposed";
    const parsed = validateTreatment(treatmentInput(fd, { name: current.name, total_sessions: current.total_sessions, billing_mode: current.billing_mode } as Partial<Treatment>));
    if (!parsed.ok) throw new DbError("invalid_input", Object.values(parsed.errors).join(" "));
    const v = parsed.value;
    await db.update("treatments", id, {
      name: v.name,
      goal: v.goal,
      interval_days: v.interval_days,
      frequency_note: v.frequency_note,
      price_total: v.price_total,
      session_price: v.session_price,
      valid_until: v.valid_until,
      notes: v.notes,
      ...(proposed ? { total_sessions: v.total_sessions, billing_mode: v.billing_mode } : {}),
    });
    return "Alterações salvas.";
  }, PATHS);
}

// ---------------------------------------------------------------------------
// Sessões
// ---------------------------------------------------------------------------

/** Agenda ou remarca uma sessão (cria/troca o horário na agenda única). Erro reabre o formulário. */
export async function scheduleSessionAction(fd: FormData): Promise<void> {
  const treatmentId = str(fd, "treatment_id");
  const sessionId = str(fd, "session_id");
  const open = `${here(treatmentId)}?agendar=${encodeURIComponent(sessionId)}`;

  const date = str(fd, "date");
  const time = str(fd, "time");
  if (!isValidDateISO(date) || !/^\d{2}:\d{2}$/.test(time)) redirect(withParam(open, "erro", "Informe a data e o horário."));
  const durationRaw = str(fd, "duration");
  const duration = durationRaw ? Number(durationRaw) : null;
  if (duration !== null && (!Number.isInteger(duration) || duration < 5 || duration > 480)) redirect(withParam(open, "erro", "A duração vai de 5 a 480 minutos."));

  const res = await guarded(async (db) => {
    const service = optStr(fd, "service_id");
    if (service) await db.update("treatment_sessions", sessionId, { service_id: service });
    await db.rpc("schedule_session", { p_session_id: sessionId, p_starts_at: isoAt(date, time), p_duration_minutes: duration });
  }, PATHS);
  redirect(res?.error ? withParam(open, "erro", res.error) : withParam(here(treatmentId), "aviso", "Sessão agendada.", ["agendar"]));
}

/** Marca a sessão como realizada; a nota vira evolução. A última sessão encerra o tratamento. */
export async function completeSessionAction(fd: FormData): Promise<void> {
  const treatmentId = str(fd, "treatment_id");
  const sessionId = str(fd, "session_id");
  const open = `${here(treatmentId)}?concluir=${encodeURIComponent(sessionId)}`;

  const notes = str(fd, "notes");
  if (notes) {
    const ev = validateEvolution(notes);
    if (!ev.ok) redirect(withParam(open, "erro", ev.error));
  }

  let finished = false;
  const res = await guarded(async (db) => {
    await db.rpc("complete_session", { p_session_id: sessionId, p_notes: notes || null });
    finished = (await db.get("treatments", treatmentId))?.status === "completed";
  }, PATHS);
  if (res?.error) redirect(withParam(open, "erro", res.error));
  redirect(withParam(here(treatmentId), "aviso", finished ? "Sessão realizada. Era a última: o tratamento foi concluído." : "Sessão marcada como realizada.", ["concluir"]));
}

// ---------------------------------------------------------------------------
// Evolução
// ---------------------------------------------------------------------------

/** Nota de acompanhamento avulsa (fora da conclusão de uma sessão). Sem campo de diagnóstico. */
export async function addEvolutionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = validateEvolution(str(fd, "notes"));
  if (!parsed.ok) return { error: parsed.error };
  return guarded(async (db) => {
    await db.insert("evolutions", { treatment_id: str(fd, "treatment_id"), session_id: optStr(fd, "session_id"), notes: parsed.value });
    return "Evolução registrada.";
  }, PATHS);
}

export async function deleteEvolutionAction(fd: FormData): Promise<void> {
  const treatmentId = str(fd, "treatment_id");
  const res = await guarded((db) => db.remove("evolutions", str(fd, "id")), PATHS);
  redirect(withParam(here(treatmentId), res?.error ? "erro" : "aviso", res?.error ?? "Registro de evolução removido."));
}
