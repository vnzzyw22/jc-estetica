// Regras da triagem compartilhadas entre a página pública, a ação de servidor e o painel.
// Arquivo PURO (sem imports com alias): roda nos testes unitários do Node.
// Minimização: só o necessário para a Jennifer entender a demanda. Informação clínica
// detalhada fica para a anamnese, conduzida por ela.

export type Option<V extends string = string> = { value: V; label: string; hint?: string };

export const AREA_OPTIONS: Option[] = [
  { value: "facial_olhar", label: "Rosto e olhar", hint: "Pele, manchas, textura, sobrancelhas, cílios" },
  { value: "corporal_modelagem", label: "Corpo e modelagem", hint: "Medidas, contorno, modelagem" },
  { value: "terapias_bem_estar", label: "Relaxamento e bem-estar", hint: "Tensão, descanso, estresse" },
  { value: "not_sure", label: "Ainda não sei", hint: "Conto o que sinto e a Jennifer orienta" },
];

export const GOAL_OPTIONS: Array<Option & { areas: string[] }> = [
  { value: "melhorar_pele", label: "Melhorar a aparência da pele", areas: ["facial_olhar"] },
  { value: "manchas", label: "Tratar manchas", areas: ["facial_olhar"] },
  { value: "textura", label: "Melhorar a textura da pele", areas: ["facial_olhar"] },
  { value: "rejuvenescimento", label: "Rejuvenescimento", areas: ["facial_olhar"] },
  { value: "sobrancelhas", label: "Sobrancelhas", areas: ["facial_olhar"] },
  { value: "cilios", label: "Cílios", areas: ["facial_olhar"] },
  { value: "reduzir_medidas", label: "Reduzir medidas", areas: ["corporal_modelagem"] },
  { value: "modelagem", label: "Modelagem corporal", areas: ["corporal_modelagem"] },
  { value: "relaxamento", label: "Relaxamento", areas: ["terapias_bem_estar"] },
  { value: "outro", label: "Outro", areas: ["facial_olhar", "corporal_modelagem", "terapias_bem_estar", "not_sure"] },
];

/** Objetivos exibidos para a área escolhida ("Ainda não sei" mostra todos). */
export function goalsForArea(area: string): typeof GOAL_OPTIONS {
  if (area === "not_sure" || !area) return GOAL_OPTIONS;
  return GOAL_OPTIONS.filter((g) => g.areas.includes(area));
}

export const DURATION_OPTIONS: Option[] = [
  { value: "recent", label: "Recente", hint: "Menos de 3 meses" },
  { value: "months", label: "Alguns meses", hint: "De 3 meses a 1 ano" },
  { value: "long", label: "Faz tempo", hint: "Mais de 1 ano" },
];

export const PREVIOUS_OPTIONS: Option[] = [
  { value: "yes", label: "Sim, já fiz" },
  { value: "no", label: "Não, seria a primeira vez" },
  { value: "tell_later", label: "Prefiro contar na avaliação" },
];

export const PERIOD_OPTIONS: Option[] = [
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noite" },
  { value: "any", label: "Tanto faz" },
];

export const VISITS_OPTIONS: Option[] = [
  { value: "1_2", label: "1 a 2 vezes" },
  { value: "3_4", label: "3 a 4 vezes" },
  { value: "more", label: "Mais de 4 vezes" },
  { value: "unsure", label: "Ainda não sei" },
];

export const CONTACT_OPTIONS: Option[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Ligação" },
  { value: "any", label: "Tanto faz" },
];

export const SOURCES = ["instagram", "whatsapp", "referral", "site"] as const;
export type ScreeningSourceKey = (typeof SOURCES)[number];

// ---------------------------------------------------------------------------
// Rótulos (painel)
// ---------------------------------------------------------------------------
export const SCREENING_STATUS: Array<Option> = [
  { value: "new", label: "Nova" },
  { value: "in_review", label: "Em análise" },
  { value: "evaluation_scheduled", label: "Avaliação agendada" },
  { value: "evaluated", label: "Avaliada" },
  { value: "treatment_proposed", label: "Tratamento proposto" },
  { value: "treatment_active", label: "Tratamento ativo" },
  { value: "closed", label: "Encerrada" },
];

export const SOURCE_LABEL: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  referral: "Indicação",
  site: "Site",
  other: "Outra",
};

const labelOf = (options: Option[], value: unknown): string | null => {
  const found = options.find((o) => o.value === value);
  return found ? found.label : null;
};

export const labels = {
  status: (v: string) => labelOf(SCREENING_STATUS, v) ?? v,
  area: (v: unknown) => labelOf(AREA_OPTIONS, v),
  goal: (v: unknown) => labelOf(GOAL_OPTIONS, v),
  duration: (v: unknown) => labelOf(DURATION_OPTIONS, v),
  previous: (v: unknown) => labelOf(PREVIOUS_OPTIONS, v),
  period: (v: unknown) => labelOf(PERIOD_OPTIONS, v),
  visits: (v: unknown) => labelOf(VISITS_OPTIONS, v),
  contact: (v: unknown) => labelOf(CONTACT_OPTIONS, v),
};

// ---------------------------------------------------------------------------
// Validação (servidor e cliente usam a MESMA função; o banco valida de novo)
// ---------------------------------------------------------------------------
export interface ScreeningInput {
  area?: unknown;
  complaint?: unknown;
  goal?: unknown;
  desiredOutcome?: unknown;
  duration?: unknown;
  previous?: unknown;
  notes?: unknown;
  period?: unknown;
  visits?: unknown;
  contactPreference?: unknown;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  consent?: unknown;
}

export interface ScreeningPayload {
  area: string;
  complaint: string;
  goal: string;
  desiredOutcome: string | null;
  answers: Record<string, string>;
  name: string;
  phone: string;
  email: string | null;
}

export type FieldErrors = Partial<Record<keyof ScreeningInput, string>>;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(CONTROL_CHARS, "").trim().slice(0, max) : "");
const oneOf = (options: Option[], v: unknown): string | null => (typeof v === "string" && options.some((o) => o.value === v) ? v : null);

/** Passo (1–5) em que cada campo é preenchido; usado para levar a pessoa ao primeiro erro. */
export const FIELD_STEP: Record<keyof ScreeningInput, number> = {
  area: 1, complaint: 1, goal: 2, desiredOutcome: 2, duration: 3, previous: 3, notes: 3,
  period: 4, visits: 4, contactPreference: 4, name: 5, phone: 5, email: 5, consent: 5,
};

export function validateScreening(input: ScreeningInput): { ok: true; value: ScreeningPayload } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const area = oneOf(AREA_OPTIONS, input.area);
  if (!area) errors.area = "Escolha o que mais combina com você.";

  const complaint = clean(input.complaint, 1000);
  if (complaint.length < 10) errors.complaint = "Conte um pouco mais, com pelo menos 10 letras.";

  const goal = oneOf(GOAL_OPTIONS, input.goal);
  if (!goal) errors.goal = "Escolha um objetivo.";
  else if (area && !goalsForArea(area).some((g) => g.value === goal)) errors.goal = "Escolha um objetivo da lista.";

  const desiredOutcome = clean(input.desiredOutcome, 600);
  const notes = clean(input.notes, 600);

  const name = clean(input.name, 120);
  if (name.length < 2) errors.name = "Informe seu nome.";

  const phone = clean(input.phone, 30).replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 11) errors.phone = "Informe o WhatsApp com DDD, por exemplo (44) 99999-9999.";

  const email = clean(input.email, 200);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "Esse e-mail não parece válido.";

  if (input.consent !== true) errors.consent = "Para enviar, é preciso concordar.";

  // Opcionais: valor desconhecido é descartado (nunca gravamos texto livre nessas chaves).
  const answers: Record<string, string> = {};
  const duration = oneOf(DURATION_OPTIONS, input.duration);
  const previous = oneOf(PREVIOUS_OPTIONS, input.previous);
  const period = oneOf(PERIOD_OPTIONS, input.period);
  const visits = oneOf(VISITS_OPTIONS, input.visits);
  const contact = oneOf(CONTACT_OPTIONS, input.contactPreference);
  if (duration) answers.duration = duration;
  if (previous) answers.previous_treatment = previous;
  if (notes) answers.notes = notes;
  if (period) answers.preferred_period = period;
  if (visits) answers.visits_per_month = visits;
  if (contact) answers.contact_preference = contact;

  if (Object.keys(errors).length || !area || !goal) return { ok: false, errors };
  return { ok: true, value: { area, complaint, goal, desiredOutcome: desiredOutcome || null, answers, name, phone, email: email || null } };
}

// ---------------------------------------------------------------------------
// Origem (?origem=instagram no link da bio)
// ---------------------------------------------------------------------------
export function normalizeSource(raw: unknown): ScreeningSourceKey {
  const v = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (v === "instagram" || v === "ig") return "instagram";
  if (v === "whatsapp" || v === "wa") return "whatsapp";
  if (v === "indicacao" || v === "indicação" || v === "referral") return "referral";
  return "site";
}

/** Campanha/detalhe livre (ex.: reels-setembro): só letras, números, hífen, ponto e sublinhado. */
export function normalizeCampaign(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  return /^[\w.\- ]{1,80}$/.test(v) ? v : null;
}
