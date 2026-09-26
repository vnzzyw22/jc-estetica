import type { Db } from "@/lib/data/db";
import { dateISOFromEpoch, isoAt } from "@/lib/date";
import { monthRange } from "@/lib/finance";
import type { CashFlowRow, Client, Expense, ExpenseCategory, Payment } from "@/lib/types";

// Carregadores do financeiro. A conta em si (somar, agrupar, atrasar) é de finance.ts.

/** Movimentos do caixa cuja data cai no mês: pagos (data do pagamento) e previstos (vencimento). */
export function loadMonthFlow(db: Db, month: string): Promise<CashFlowRow[]> {
  const { first, next } = monthRange(month);
  return db.list("cash_flow", { gte: { occurred_on: first }, lt: { occurred_on: next }, order: [["occurred_on", "asc"]] });
}

/** Movimentos do caixa entre dois meses (inclusive), para séries e comparativos. */
export function loadFlowBetween(db: Db, firstMonth: string, lastMonth: string): Promise<CashFlowRow[]> {
  return db.list("cash_flow", { gte: { occurred_on: monthRange(firstMonth).first }, lt: { occurred_on: monthRange(lastMonth).next }, order: [["occurred_on", "asc"]] });
}

/** Previsto e já vencido, de qualquer mês: o que está atrasado hoje. */
export function loadOverdueFlow(db: Db, today: string): Promise<CashFlowRow[]> {
  return db.list("cash_flow", { eq: { state: "expected" }, lt: { occurred_on: today }, order: [["occurred_on", "asc"]] });
}

export async function loadClientMap(db: Db): Promise<Map<string, Client>> {
  return new Map((await db.list("clients")).map((c) => [c.id, c]));
}

// ---------------------------------------------------------------------------
// Data que vale para cada registro (a mesma regra da view cash_flow)
// ---------------------------------------------------------------------------

/** Recebido → dia do recebimento; qualquer outro estado → vencimento. */
export const paymentDate = (p: Payment): string => (p.status === "paid" && p.paid_at ? dateISOFromEpoch(Date.parse(p.paid_at)) : p.due_date);

/** Pago → dia do pagamento; a pagar → dia da despesa. */
export const expenseDate = (e: Expense): string => (e.paid_at ? dateISOFromEpoch(Date.parse(e.paid_at)) : e.incurred_on);

const byDateDesc = <T,>(date: (row: T) => string) => (a: T, b: T) => (date(a) < date(b) ? 1 : date(a) > date(b) ? -1 : 0);

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((r) => [r.id, r])).values()];
}

// ---------------------------------------------------------------------------
// Listas (recebimentos e despesas do mês, atrasados, por cliente)
// ---------------------------------------------------------------------------

/**
 * Recebimentos do mês, incluindo cancelados: pagos pela data do recebimento, os demais pelo vencimento.
 * Duas consultas limitadas (por vencimento e por data de recebimento) em vez de trazer a tabela toda.
 */
export async function loadMonthPayments(db: Db, month: string): Promise<Payment[]> {
  const { first, next } = monthRange(month);
  const [byDue, byPaid] = await Promise.all([
    db.list("payments", { gte: { due_date: first }, lt: { due_date: next } }),
    db.list("payments", { gte: { paid_at: isoAt(first, "00:00") }, lt: { paid_at: isoAt(next, "00:00") } }),
  ]);
  return uniqueById([...byDue, ...byPaid])
    .filter((p) => {
      const d = paymentDate(p);
      return d >= first && d < next;
    })
    .sort(byDateDesc(paymentDate));
}

/** Recebimentos pendentes com vencimento anterior a hoje, do mais antigo ao mais novo. */
export async function loadOverduePayments(db: Db, today: string): Promise<Payment[]> {
  return db.list("payments", { eq: { status: "pending" }, lt: { due_date: today }, order: [["due_date", "asc"]] });
}

export async function loadClientPayments(db: Db, clientId: string): Promise<Payment[]> {
  const rows = await db.list("payments", { eq: { client_id: clientId } });
  return rows.sort(byDateDesc(paymentDate));
}

/** Despesas do mês: pagas pela data do pagamento, as demais pela data da despesa. */
export async function loadMonthExpenses(db: Db, month: string): Promise<Expense[]> {
  const { first, next } = monthRange(month);
  const [byDate, byPaid] = await Promise.all([
    db.list("expenses", { gte: { incurred_on: first }, lt: { incurred_on: next } }),
    db.list("expenses", { gte: { paid_at: isoAt(first, "00:00") }, lt: { paid_at: isoAt(next, "00:00") } }),
  ]);
  return uniqueById([...byDate, ...byPaid])
    .filter((e) => {
      const d = expenseDate(e);
      return d >= first && d < next;
    })
    .sort(byDateDesc(expenseDate));
}

/** Despesas a pagar com data anterior a hoje. */
export async function loadOverdueExpenses(db: Db, today: string): Promise<Expense[]> {
  const rows = await db.list("expenses", { lt: { incurred_on: today }, order: [["incurred_on", "asc"]] });
  return rows.filter((e) => e.paid_at === null);
}

export const loadCategories = (db: Db): Promise<ExpenseCategory[]> => db.list("expense_categories", { order: [["kind", "asc"], ["name", "asc"]] });
