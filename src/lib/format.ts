export function formatPrice(price: number | null | undefined): string {
  if (price == null) return "sob avaliação";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Fatos exibíveis de um serviço: só o que é conhecido (duração confirmada, valor). */
export function serviceFacts(s: { duration_minutes: number; duration_confirmed: boolean; price: number | null }): string[] {
  const facts: string[] = [];
  if (s.duration_confirmed) facts.push(formatDuration(s.duration_minutes));
  if (s.price != null) facts.push(formatPrice(s.price));
  return facts;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Máscara progressiva de telefone BR: (44) 99999-9999. */
export function maskPhone(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const CATEGORY_LABEL: Record<string, string> = {
  facial_olhar: "Estética facial & olhar",
  corporal_modelagem: "Estética corporal & modelagem",
  terapias_bem_estar: "Terapias integradas & bem-estar",
  facial: "Facial",
  corporal: "Corporal",
  espaco: "Espaço",
  profissional: "Profissional",
};

/** Rótulo curto das categorias (abas e filtros, onde o nome completo não cabe). */
export const CATEGORY_SHORT: Record<string, string> = {
  facial_olhar: "Facial & olhar",
  corporal_modelagem: "Corporal & modelagem",
  terapias_bem_estar: "Terapias & bem-estar",
};

/** Nome do tipo de agendamento quando não há serviço do catálogo. */
export const KIND_LABEL: Record<string, string> = {
  evaluation: "Avaliação",
  return: "Retorno",
  session: "Sessão de tratamento",
  service: "Serviço",
  other: "Agendamento",
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const BLOCK_KIND_LABEL: Record<string, string> = {
  block: "Bloqueio",
  day_off: "Dia fechado",
  vacation: "Férias",
  holiday: "Feriado",
  personal: "Compromisso particular",
};
