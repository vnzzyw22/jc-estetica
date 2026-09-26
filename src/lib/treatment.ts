// Regras de pacotes, tratamentos e sessões. Arquivo PURO (sem imports com alias): roda nos testes unitários.
// O que precisa ser atômico (ativar, agendar, concluir, cancelar) vive em funções SQL; aqui ficam os
// rótulos, o que cada estado permite e a validação dos formulários.
// Valores em reais chegam já lidos pela ação (`parseMoney`): número, null (vazio) ou NaN (ilegível).

export const TREATMENT_STATUS_LABEL: Record<string, string> = {
  proposed: "Proposto",
  active: "Em andamento",
  paused: "Pausado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const SESSION_STATUS_LABEL: Record<string, string> = {
  unscheduled: "A agendar",
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  rescheduled: "Remarcada",
};

export const BILLING_LABEL: Record<string, string> = {
  package: "Pacote fechado",
  per_session: "Por sessão",
};

// ---------------------------------------------------------------------------
// O que cada estado permite
// ---------------------------------------------------------------------------
export interface TreatmentActions {
  /** Proposto → em andamento (gera as sessões). */
  start: boolean;
  /** Pausado → em andamento (não gera sessões de novo). */
  resume: boolean;
  pause: boolean;
  cancel: boolean;
  /** Só proposto: um tratamento com sessões ou cobranças é histórico. O banco também protege. */
  remove: boolean;
  edit: boolean;
}

export function treatmentActions(status: string): TreatmentActions {
  const open = status === "proposed" || status === "active" || status === "paused";
  return { start: status === "proposed", resume: status === "paused", pause: status === "active", cancel: open, remove: status === "proposed", edit: open };
}

const OPEN_SESSION = ["unscheduled", "scheduled", "confirmed", "rescheduled"];
const BOOKED_SESSION = ["scheduled", "confirmed", "rescheduled"];

export interface SessionActions {
  schedule: boolean;
  /** Registrar como realizada. Vale até para sessão sem horário marcado (atendimento encaixado). */
  complete: boolean;
}

export function sessionActions(sessionStatus: string, treatmentStatus: string): SessionActions {
  const usable = treatmentStatus === "active" && OPEN_SESSION.includes(sessionStatus);
  return { schedule: usable, complete: usable };
}

export interface SessionLike {
  number: number;
  status: string;
}

export interface Progress {
  total: number;
  done: number;
  /** Com horário na agenda. */
  booked: number;
  toSchedule: number;
  cancelled: number;
  /** Realizadas sobre as que ainda contam (canceladas saem da conta). 0 a 100. */
  percent: number;
}

export function sessionProgress(sessions: SessionLike[]): Progress {
  const done = sessions.filter((s) => s.status === "completed").length;
  const cancelled = sessions.filter((s) => s.status === "cancelled").length;
  const booked = sessions.filter((s) => BOOKED_SESSION.includes(s.status)).length;
  const toSchedule = sessions.filter((s) => s.status === "unscheduled").length;
  const counting = sessions.length - cancelled;
  return { total: sessions.length, done, booked, toSchedule, cancelled, percent: counting > 0 ? Math.round((done / counting) * 100) : 0 };
}

/** A próxima sessão a acontecer: a de menor número ainda em aberto. */
export function nextOpenSession<T extends SessionLike>(sessions: T[]): T | undefined {
  return sessions.filter((s) => OPEN_SESSION.includes(s.status)).sort((a, b) => a.number - b.number)[0];
}

// ---------------------------------------------------------------------------
// Validação dos formulários
// ---------------------------------------------------------------------------
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(CONTROL, "").trim().slice(0, max) : "");
const tooLong = (v: unknown, max: number): boolean => typeof v === "string" && v.replace(CONTROL, "").trim().length > max;

/** Inteiro entre min e max; vazio vira null; qualquer outra coisa vira "invalid". */
function intOf(v: unknown, min: number, max: number): number | null | "invalid" {
  const raw = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (raw === "") return null;
  if (!/^\d+$/.test(raw)) return "invalid";
  const n = Number(raw);
  return n >= min && n <= max ? n : "invalid";
}

/** Dinheiro já lido pela ação: null = vazio, NaN ou negativo = inválido. */
function moneyOf(v: unknown): number | null | "invalid" {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return "invalid";
  return v;
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export type Result<V, K extends string> = { ok: true; value: V } | { ok: false; errors: Partial<Record<K, string>> };

export interface PackageInput {
  name?: unknown;
  description?: unknown;
  goal?: unknown;
  session_count?: unknown;
  interval_days?: unknown;
  frequency_note?: unknown;
  price?: unknown;
  validity_days?: unknown;
  notes?: unknown;
}

export interface PackageValue {
  name: string;
  description: string | null;
  goal: string | null;
  session_count: number;
  interval_days: number | null;
  frequency_note: string | null;
  price: number | null;
  validity_days: number | null;
  notes: string | null;
}

export function validatePackage(input: PackageInput): Result<PackageValue, keyof PackageInput> {
  const errors: Partial<Record<keyof PackageInput, string>> = {};

  const name = clean(input.name, 120);
  if (name.length < 2) errors.name = "Dê um nome ao pacote.";

  const sessions = intOf(input.session_count, 1, 200);
  if (sessions === null || sessions === "invalid") errors.session_count = "Informe quantas sessões, de 1 a 200.";
  const interval = intOf(input.interval_days, 1, 365);
  if (interval === "invalid") errors.interval_days = "O intervalo entre sessões vai de 1 a 365 dias.";
  const validity = intOf(input.validity_days, 1, 1825);
  if (validity === "invalid") errors.validity_days = "A validade vai de 1 a 1825 dias.";
  const price = moneyOf(input.price);
  if (price === "invalid") errors.price = "Informe um valor válido, por exemplo 1200,00.";

  for (const [key, max] of [["description", 1000], ["goal", 300], ["frequency_note", 200], ["notes", 2000]] as const) {
    if (tooLong(input[key], max)) errors[key] = `Passou de ${max} caracteres.`;
  }

  if (Object.keys(errors).length || sessions === null || sessions === "invalid" || interval === "invalid" || validity === "invalid" || price === "invalid") return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      description: clean(input.description, 1000) || null,
      goal: clean(input.goal, 300) || null,
      session_count: sessions,
      interval_days: interval,
      frequency_note: clean(input.frequency_note, 200) || null,
      price,
      validity_days: validity,
      notes: clean(input.notes, 2000) || null,
    },
  };
}

export interface TreatmentInput {
  name?: unknown;
  goal?: unknown;
  total_sessions?: unknown;
  interval_days?: unknown;
  frequency_note?: unknown;
  billing_mode?: unknown;
  price_total?: unknown;
  session_price?: unknown;
  valid_until?: unknown;
  notes?: unknown;
}

export interface TreatmentValue {
  name: string;
  goal: string | null;
  total_sessions: number;
  interval_days: number | null;
  frequency_note: string | null;
  billing_mode: "package" | "per_session";
  price_total: number | null;
  session_price: number | null;
  valid_until: string | null;
  notes: string | null;
}

export function validateTreatment(input: TreatmentInput): Result<TreatmentValue, keyof TreatmentInput> {
  const errors: Partial<Record<keyof TreatmentInput, string>> = {};

  const name = clean(input.name, 120);
  if (name.length < 2) errors.name = "Dê um nome ao tratamento.";

  const total = intOf(input.total_sessions, 1, 200);
  if (total === null || total === "invalid") errors.total_sessions = "Informe quantas sessões, de 1 a 200.";
  const interval = intOf(input.interval_days, 1, 365);
  if (interval === "invalid") errors.interval_days = "O intervalo entre sessões vai de 1 a 365 dias.";

  const billing = input.billing_mode === "per_session" ? "per_session" : "package";
  const priceTotal = moneyOf(input.price_total);
  if (priceTotal === "invalid") errors.price_total = "Informe um valor válido, por exemplo 1200,00.";
  const sessionPrice = moneyOf(input.session_price);
  if (sessionPrice === "invalid") errors.session_price = "Informe um valor válido, por exemplo 150,00.";
  else if (billing === "per_session" && (sessionPrice === null || sessionPrice <= 0)) errors.session_price = "Na cobrança por sessão, informe o valor de cada sessão.";

  const validRaw = clean(input.valid_until, 10);
  if (validRaw && !isRealDate(validRaw)) errors.valid_until = "Data de validade inválida.";

  for (const [key, max] of [["goal", 300], ["frequency_note", 200], ["notes", 2000]] as const) {
    if (tooLong(input[key], max)) errors[key] = `Passou de ${max} caracteres.`;
  }

  if (Object.keys(errors).length || total === null || total === "invalid" || interval === "invalid" || priceTotal === "invalid" || sessionPrice === "invalid") return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      goal: clean(input.goal, 300) || null,
      total_sessions: total,
      interval_days: interval,
      frequency_note: clean(input.frequency_note, 200) || null,
      billing_mode: billing,
      price_total: priceTotal,
      session_price: sessionPrice,
      valid_until: validRaw || null,
      notes: clean(input.notes, 2000) || null,
    },
  };
}

/** Nota de evolução: texto de acompanhamento, sem campo de diagnóstico. */
export function validateEvolution(notes: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const text = clean(notes, 4001);
  if (text.length < 2) return { ok: false, error: "Escreva a evolução." };
  if (text.length > 4000) return { ok: false, error: "A evolução passou de 4000 caracteres." };
  return { ok: true, value: text };
}
