import type { Db } from "@/lib/data/db";
import { monthRange } from "@/lib/finance";
import type { CashFlowRow, Client } from "@/lib/types";

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
