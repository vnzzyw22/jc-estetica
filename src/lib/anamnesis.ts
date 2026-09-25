// Regras da anamnese profissional. Arquivo PURO (sem imports com alias): roda nos testes unitários.
// O sistema é de gestão e acompanhamento: NÃO há campo de diagnóstico.

export interface AnamnesisField {
  key: "evaluation" | "relevant_history" | "contraindications" | "additional_info" | "professional_notes";
  label: string;
  hint?: string;
  rows: number;
}

export const ANAMNESIS_FIELDS: AnamnesisField[] = [
  { key: "evaluation", label: "Avaliação", hint: "O que você observou e avaliou no atendimento.", rows: 5 },
  { key: "relevant_history", label: "Histórico relevante", hint: "Informações de saúde e hábitos que importam para o tratamento.", rows: 5 },
  { key: "contraindications", label: "Contraindicações e pontos de atenção", hint: "O que exige cuidado ou impede algum procedimento.", rows: 4 },
  { key: "additional_info", label: "Informações adicionais", rows: 3 },
  { key: "professional_notes", label: "Observações profissionais", hint: "Só você vê.", rows: 4 },
];

export const MAX_LEN = 6000;

export type AnamnesisIntent = "draft" | "complete";

export interface AnamnesisInput {
  assessed_at?: unknown;
  evaluation?: unknown;
  relevant_history?: unknown;
  contraindications?: unknown;
  additional_info?: unknown;
  professional_notes?: unknown;
}

export interface AnamnesisValue {
  assessed_at: string | null;
  evaluation: string | null;
  relevant_history: string | null;
  contraindications: string | null;
  additional_info: string | null;
  professional_notes: string | null;
}

export type AnamnesisErrors = Partial<Record<keyof AnamnesisInput | "form", string>>;

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const text = (v: unknown): string => (typeof v === "string" ? v.replace(CONTROL, "").trim() : "");

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** `todayISO` vem de fora para a função continuar pura e testável. */
export function validateAnamnesis(input: AnamnesisInput, intent: AnamnesisIntent, todayISO: string): { ok: true; value: AnamnesisValue } | { ok: false; errors: AnamnesisErrors } {
  const errors: AnamnesisErrors = {};
  const value: AnamnesisValue = { assessed_at: null, evaluation: null, relevant_history: null, contraindications: null, additional_info: null, professional_notes: null };

  const date = text(input.assessed_at);
  if (date) {
    if (!isRealDate(date)) errors.assessed_at = "Data inválida.";
    else if (date > todayISO) errors.assessed_at = "A data da avaliação não pode estar no futuro.";
    else value.assessed_at = date;
  }

  for (const f of ANAMNESIS_FIELDS) {
    const v = text(input[f.key]);
    if (v.length > MAX_LEN) errors[f.key] = `Passou de ${MAX_LEN} caracteres.`;
    else value[f.key] = v || null;
  }

  if (intent === "complete") {
    if (!value.assessed_at && !errors.assessed_at) errors.assessed_at = "Informe a data da avaliação para concluir.";
    if (!value.evaluation && !value.professional_notes && !value.relevant_history) {
      errors.form = "Para concluir, preencha ao menos a avaliação, o histórico ou as observações profissionais.";
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
