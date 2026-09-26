import type { CashFlowRow, PaymentStatus } from "@/lib/types";

// Regras puras do financeiro (sem banco, sem React): testadas em tests/unit/finance.test.mjs.
// Valores circulam em REAIS (number), mas toda soma é feita em CENTAVOS inteiros: 0,1 + 0,2 não
// pode virar 0,30000000000000004 num relatório de caixa.

const cents = (value: number): number => Math.round(value * 100);
const reais = (c: number): number => c / 100;

/** "2026-09" */
export const isMonth = (value: string | undefined | null): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Primeiro dia, último dia e primeiro dia do mês seguinte (limite exclusivo) de "YYYY-MM". */
export function monthRange(month: string): { first: string; last: string; next: string } {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(days).padStart(2, "0")}`, next: `${addMonths(month, 1)}-01` };
}

/**
 * Lê um valor em reais digitado à brasileira. Aceita "1.234,56", "1234,56", "1234.56", "R$ 120".
 * Devolve null quando não é número; nunca devolve NaN. Arredonda em 2 casas.
 */
export function parseMoney(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).replace(/R\$/gi, "").replace(/\s/g, "");
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Soma valores em reais sem erro de ponto flutuante (conta em centavos). */
export function sumMoney(values: number[]): number {
  return reais(values.reduce((sum, v) => sum + cents(v), 0));
}

export interface Totals {
  /** Entradas que já aconteceram. */
  received: number;
  /** Entradas previstas (pendentes). */
  toReceive: number;
  /** Saídas que já aconteceram. */
  paid: number;
  /** Saídas previstas (a pagar). */
  toPay: number;
  /** Recebido − pago: o que realmente sobrou. */
  result: number;
  /** Se tudo o que está previsto acontecer: (recebido + a receber) − (pago + a pagar). */
  forecast: number;
}

const inRange = (r: CashFlowRow, from: string, to: string): boolean => r.occurred_on >= from && r.occurred_on <= to;

export function totalsOf(rows: CashFlowRow[]): Totals {
  let received = 0;
  let toReceive = 0;
  let paid = 0;
  let toPay = 0;
  for (const r of rows) {
    const c = cents(r.amount);
    const done = r.state === "realized";
    if (r.direction === "in") {
      if (done) received += c;
      else toReceive += c;
    } else if (done) paid += c;
    else toPay += c;
  }
  return {
    received: reais(received),
    toReceive: reais(toReceive),
    paid: reais(paid),
    toPay: reais(toPay),
    result: reais(received - paid),
    forecast: reais(received + toReceive - paid - toPay),
  };
}

/** Totais das linhas cuja data (pagamento, se pago; vencimento, se previsto) cai em [from, to]. */
export function periodTotals(rows: CashFlowRow[], from: string, to: string): Totals {
  return totalsOf(rows.filter((r) => inRange(r, from, to)));
}

export interface MonthPoint extends Totals {
  month: string;
}

/** Uma linha por mês, do mais antigo ao `endMonth`, mesmo os meses sem movimento. */
export function monthSeries(rows: CashFlowRow[], endMonth: string, count: number): MonthPoint[] {
  const months = Array.from({ length: count }, (_, i) => addMonths(endMonth, i - (count - 1)));
  return months.map((month) => ({ month, ...totalsOf(rows.filter((r) => r.occurred_on.slice(0, 7) === month)) }));
}

export interface Slice {
  key: string;
  total: number;
  count: number;
}

/** Soma por chave, da maior para a menor (empate: ordem alfabética, para o resultado ser estável). */
export function sumBy(rows: CashFlowRow[], keyOf: (r: CashFlowRow) => string): Slice[] {
  const map = new Map<string, { c: number; n: number }>();
  for (const r of rows) {
    const k = keyOf(r);
    const cur = map.get(k) ?? { c: 0, n: 0 };
    cur.c += cents(r.amount);
    cur.n += 1;
    map.set(k, cur);
  }
  return [...map.entries()].map(([key, v]) => ({ key, total: reais(v.c), count: v.n })).sort((a, b) => b.total - a.total || a.key.localeCompare(b.key, "pt-BR"));
}

/** Previsto e já vencido (data anterior a `today`): o que está atrasado. */
export function overdueRows(rows: CashFlowRow[], today: string, direction: "in" | "out"): CashFlowRow[] {
  return rows.filter((r) => r.direction === direction && r.state === "expected" && r.occurred_on < today).sort((a, b) => (a.occurred_on < b.occurred_on ? -1 : 1));
}

export type PaymentView = "paid" | "overdue" | "pending" | "cancelled" | "refunded";

/** Estado exibido de um recebimento: pendente com vencimento passado vira "atrasado". */
export function paymentView(p: { status: PaymentStatus; due_date: string }, today: string): PaymentView {
  if (p.status === "pending") return p.due_date < today ? "overdue" : "pending";
  return p.status;
}

export function daysLate(dueDate: string, today: string): number {
  const ms = Date.parse(`${today}T12:00:00Z`) - Date.parse(`${dueDate}T12:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** "2/4" quando há mais de uma parcela; senão vazio. */
export function installmentLabel(p: { installment_number: number; installment_total: number }): string {
  return p.installment_total > 1 ? `${p.installment_number}/${p.installment_total}` : "";
}

/** Divide um total em parcelas iguais; a última absorve os centavos (espelha create_receivable). */
export function splitInstallments(total: number, count: number): number[] {
  const totalC = cents(total);
  const base = Math.trunc(totalC / count);
  return Array.from({ length: count }, (_, i) => reais(i === count - 1 ? totalC - base * (count - 1) : base));
}

export interface DayGroup {
  date: string;
  rows: CashFlowRow[];
}

/** Agrupa o extrato por dia, do mais recente ao mais antigo; dentro do dia, o realizado vem antes do previsto. */
export function groupByDay(rows: CashFlowRow[]): DayGroup[] {
  const map = new Map<string, CashFlowRow[]>();
  for (const r of rows) map.set(r.occurred_on, [...(map.get(r.occurred_on) ?? []), r]);
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, list]) => ({ date, rows: [...list].sort((a, b) => Number(a.state === "expected") - Number(b.state === "expected")) }));
}

/** "?a=1&b=2" só com os valores preenchidos; vazio quando não sobra nenhum. */
export function queryString(params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) q.set(key, value);
  const text = q.toString();
  return text ? `?${text}` : "";
}

/** Uma linha de CSV para planilha em português: separador ";" e vírgula decimal. */
export function csvLine(cells: Array<string | number | null | undefined>): string {
  return cells
    .map((c) => {
      const raw = typeof c === "number" ? c.toFixed(2).replace(".", ",") : (c ?? "");
      const text = String(raw);
      // Neutraliza fórmulas: a planilha não deve interpretar texto vindo do usuário como comando.
      const safe = /^[=+\-@]/.test(text) && typeof c !== "number" ? `'${text}` : text;
      return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    })
    .join(";");
}
