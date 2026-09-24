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
  facial: "Facial",
  corporal: "Corporal",
  tratamentos: "Tratamentos",
  protocolos: "Protocolos",
  espaco: "Espaço",
  profissional: "Profissional",
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
