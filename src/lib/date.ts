// Brasil usa fuso fixo (America/Sao_Paulo, UTC-3, sem horário de verão desde 2019),
// então um offset fixo basta e evita dependência de biblioteca de datas.
export const TZ = "America/Sao_Paulo";
export const TZ_OFFSET = "-03:00";

const WEEKDAYS_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const weekdayLong = (i: number) => WEEKDAYS_LONG[i];
export const weekdayShort = (i: number) => WEEKDAYS_SHORT[i];
export const monthName = (i: number) => MONTHS[i];

/** "09:00:00" | "09:00" → "09:00" */
export function hm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : "";
}

export function timeToMinutes(time: string): number {
  const [h, m] = hm(time).split(":").map(Number);
  return h * 60 + m;
}

/** Instante (ms) de uma data local BR + horário "HH:MM". */
export function epochAt(dateISO: string, time: string): number {
  return new Date(`${dateISO}T${hm(time)}:00${TZ_OFFSET}`).getTime();
}

export function isoAt(dateISO: string, time: string): string {
  return new Date(epochAt(dateISO, time)).toISOString();
}

/** Data local BR (YYYY-MM-DD) de um instante. */
export function dateISOFromEpoch(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms)); // en-CA → YYYY-MM-DD
}

export function todayISO(nowMs: number = Date.now()): string {
  return dateISOFromEpoch(nowMs);
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(dateISO: string): number {
  return new Date(`${dateISO}T12:00:00Z`).getUTCDay();
}

export function isValidDateISO(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(new Date(iso));
}

export function dayLabel(dateISO: string, style: "short" | "long" = "long"): string {
  const d = Number(dateISO.slice(8, 10));
  const m = Number(dateISO.slice(5, 7)) - 1;
  const w = weekdayOf(dateISO);
  return style === "short"
    ? `${weekdayShort(w)}, ${d}/${String(m + 1).padStart(2, "0")}`
    : `${weekdayLong(w)}, ${d} de ${monthName(m)}`;
}

/** "2026-09-25" (ou um ISO completo) → "25/09/2026". Só formata o texto: não converte fuso. */
export const dateBR = (iso: string): string => iso.slice(0, 10).split("-").reverse().join("/");

export function dateTimeLabel(iso: string): string {
  return `${dayLabel(dateISOFromEpoch(new Date(iso).getTime()), "short")} às ${timeLabel(iso)}`;
}

/** Primeiro/último dia do mês "YYYY-MM". */
export function monthBounds(month: string): { first: string; last: string; days: number } {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(days).padStart(2, "0")}`, days };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const nowISO = (): string => new Date().toISOString();
