"use server";

import { redirect } from "next/navigation";
import { bool, guarded, num, optStr, str, type ActionState } from "@/lib/admin-util";
import { DbError } from "@/lib/data/db";
import { dateISOFromEpoch, isValidDateISO, isoAt, todayISO } from "@/lib/date";
import { isMonth, parseMoney } from "@/lib/finance";
import type { Payment, PaymentMethod } from "@/lib/types";

const PATHS = ["/admin/financeiro", "/admin/clientes", "/admin/dashboard"];
const METHODS: PaymentMethod[] = ["pix", "cash", "debit", "credit", "transfer", "other"];

const method = (fd: FormData): PaymentMethod | null => {
  const m = str(fd, "method") as PaymentMethod;
  return METHODS.includes(m) ? m : null;
};

/** Instante de um recebimento/pagamento: hoje = agora; outro dia = meio-dia local (evita virar o dia por fuso). */
const instantOf = (dateISO: string): string => (dateISO === todayISO() ? new Date().toISOString() : isoAt(dateISO, "12:00"));

/** Só volta para dentro do painel; qualquer outra coisa cai no padrão (evita redirecionamento aberto). */
function backTo(fd: FormData, fallback: string): string {
  const b = str(fd, "back");
  return b.startsWith("/admin/") && !b.startsWith("//") ? b : fallback;
}

/** Devolve a URL com um recado (`erro` ou `aviso`); `drop` remove outros parâmetros (ex.: o formulário aberto). */
function withParam(url: string, key: "erro" | "aviso", value: string, drop: string[] = []): string {
  const u = new URL(url, "http://local");
  for (const k of ["erro", "aviso", ...drop]) u.searchParams.delete(k);
  u.searchParams.set(key, value);
  return `${u.pathname}${u.search}`;
}

// ---------------------------------------------------------------------------
// Recebimentos
// ---------------------------------------------------------------------------

/** Novo recebimento: à vista ou parcelado, avulso ou ligado a cliente / tratamento / atendimento. */
export async function createReceivableAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const amount = parseMoney(str(fd, "amount"));
  if (amount === null || amount <= 0) return { error: "Informe um valor válido, por exemplo 150,00." };
  const installments = Math.round(num(fd, "installments", 1));
  const firstDue = str(fd, "first_due") || todayISO();
  if (!isValidDateISO(firstDue)) return { error: "Informe uma data de vencimento válida." };

  const alreadyPaid = bool(fd, "already_paid");
  const m = method(fd);
  let paidAt: string | null = null;
  if (alreadyPaid) {
    if (!m) return { error: "Escolha a forma de pagamento do que já foi recebido." };
    const paidDate = str(fd, "paid_date") || todayISO();
    if (!isValidDateISO(paidDate)) return { error: "Informe uma data de recebimento válida." };
    paidAt = instantOf(paidDate);
  }

  return guarded(async (db) => {
    const n = await db.rpc<number>("create_receivable", {
      p_client_id: optStr(fd, "client_id"),
      p_description: optStr(fd, "description"),
      p_total: amount,
      p_installments: installments,
      p_first_due: firstDue,
      p_method: m,
      p_treatment_id: optStr(fd, "treatment_id"),
      p_appointment_id: optStr(fd, "appointment_id"),
      p_paid_at: paidAt,
    });
    return n === 1 ? "Recebimento registrado." : `${n} parcelas criadas.`;
  }, PATHS);
}

/** Gera as parcelas de um tratamento a partir do valor dele (regra em create_payment_plan). */
export async function createPlanAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const firstDue = str(fd, "first_due") || todayISO();
  if (!isValidDateISO(firstDue)) return { error: "Informe a data da primeira parcela." };
  return guarded(async (db) => {
    const n = await db.rpc<number>("create_payment_plan", {
      p_treatment_id: str(fd, "treatment_id"),
      p_installments: Math.round(num(fd, "installments", 1)),
      p_first_due: firstDue,
      p_method: method(fd),
    });
    return n === 1 ? "Cobrança criada." : `${n} parcelas criadas.`;
  }, PATHS);
}

/** Registra que uma parcela foi recebida (forma + data). Em erro, volta com o formulário ainda aberto. */
export async function receivePaymentAction(fd: FormData): Promise<void> {
  const back = backTo(fd, "/admin/financeiro/recebimentos");
  const m = method(fd);
  const date = str(fd, "date") || todayISO();
  if (!m) redirect(withParam(back, "erro", "Escolha a forma de pagamento."));
  if (!isValidDateISO(date)) redirect(withParam(back, "erro", "Informe uma data válida."));
  const res = await guarded((db) => db.rpc("change_payment_status", { p_id: str(fd, "id"), p_to: "paid", p_paid_at: instantOf(date), p_method: m }).then(() => undefined), PATHS);
  redirect(res?.error ? withParam(back, "erro", res.error) : withParam(back, "aviso", "Recebimento registrado.", ["receber"]));
}

/** Botões de linha: desfazer recebimento, cancelar, restaurar. Erros voltam na própria página. */
export async function paymentStatusAction(fd: FormData): Promise<void> {
  const to = str(fd, "to");
  const back = backTo(fd, "/admin/financeiro/recebimentos");
  if (!["pending", "cancelled"].includes(to)) redirect(back);
  const res = await guarded((db) => db.rpc("change_payment_status", { p_id: str(fd, "id"), p_to: to }).then(() => undefined), PATHS);
  redirect(res?.error ? withParam(back, "erro", res.error) : withParam(back, "aviso", to === "cancelled" ? "Cobrança cancelada." : "A cobrança voltou para “a receber”."));
}

export async function updatePaymentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const amountText = str(fd, "amount");
  const amount = amountText ? parseMoney(amountText) : null;
  if (amountText && (amount === null || amount <= 0)) return { error: "Informe um valor válido, por exemplo 150,00." };
  const dueDate = str(fd, "due_date");
  if (dueDate && !isValidDateISO(dueDate)) return { error: "Informe uma data de vencimento válida." };
  const paidDate = str(fd, "paid_date");
  if (paidDate && !isValidDateISO(paidDate)) return { error: "Informe uma data de recebimento válida." };
  if (paidDate && paidDate > todayISO()) return { error: "A data do recebimento não pode estar no futuro." };
  const m = method(fd);

  return guarded(async (db) => {
    const current = await db.get("payments", id);
    if (!current) throw new DbError("payment_not_found");
    const description = optStr(fd, "description");
    if (current.kind === "other" && !description) throw new DbError("description_required");
    if (current.status === "paid" && !m) throw new DbError("method_required");

    const patch: Partial<Payment> = { description, notes: optStr(fd, "notes"), method: m };
    if (current.status === "pending") {
      if (amount !== null) patch.amount = amount;
      if (dueDate) patch.due_date = dueDate;
    }
    // Só troca a data do recebimento se o dia mudou (preserva a hora original).
    if (current.status === "paid" && paidDate && current.paid_at && dateISOFromEpoch(new Date(current.paid_at).getTime()) !== paidDate) patch.paid_at = instantOf(paidDate);
    await db.update("payments", id, patch);
    return "Alterações salvas.";
  }, PATHS);
}

/** Recebimento pago é histórico: para excluir, primeiro desfaça o recebimento. */
export async function deletePaymentAction(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  const res = await guarded(async (db) => {
    const p = await db.get("payments", id);
    if (!p) return;
    if (p.status === "paid") throw new DbError("paid_delete", "Este recebimento já foi pago. Desfaça o recebimento antes de excluir.");
    await db.remove("payments", id);
  }, PATHS);
  redirect(res?.error ? withParam(`/admin/financeiro/recebimentos/${id}`, "erro", res.error) : backTo(fd, "/admin/financeiro/recebimentos"));
}

// ---------------------------------------------------------------------------
// Despesas
// ---------------------------------------------------------------------------

export async function createExpenseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const description = str(fd, "description");
  if (description.length < 2) return { error: "Descreva a despesa." };
  const categoryId = str(fd, "category_id");
  if (!categoryId) return { error: "Escolha uma categoria." };
  const amount = parseMoney(str(fd, "amount"));
  if (amount === null || amount <= 0) return { error: "Informe um valor válido, por exemplo 89,90." };
  const incurredOn = str(fd, "incurred_on") || todayISO();
  if (!isValidDateISO(incurredOn)) return { error: "Informe uma data válida." };
  let paidAt: string | null = null;
  if (bool(fd, "already_paid")) {
    const paidDate = str(fd, "paid_date") || incurredOn;
    if (!isValidDateISO(paidDate)) return { error: "Informe a data do pagamento." };
    if (paidDate > todayISO()) return { error: "A data do pagamento não pode estar no futuro." };
    paidAt = instantOf(paidDate);
  }
  return guarded(async (db) => {
    await db.insert("expenses", { category_id: categoryId, description, amount, incurred_on: incurredOn, paid_at: paidAt, is_recurring: bool(fd, "is_recurring"), notes: optStr(fd, "notes") });
    return "Despesa registrada.";
  }, PATHS);
}

/** Edita a despesa. "Pago em" vazio = a pagar. */
export async function updateExpenseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const description = str(fd, "description");
  if (description.length < 2) return { error: "Descreva a despesa." };
  const amount = parseMoney(str(fd, "amount"));
  if (amount === null || amount <= 0) return { error: "Informe um valor válido, por exemplo 89,90." };
  const incurredOn = str(fd, "incurred_on");
  if (!isValidDateISO(incurredOn)) return { error: "Informe uma data válida." };
  const paidDate = str(fd, "paid_date");
  if (paidDate && !isValidDateISO(paidDate)) return { error: "Informe a data do pagamento." };
  if (paidDate > todayISO()) return { error: "A data do pagamento não pode estar no futuro." };
  const id = str(fd, "id");

  return guarded(async (db) => {
    const current = await db.get("expenses", id);
    if (!current) throw new DbError("expense_not_found", "Despesa não encontrada.");
    const keepPaidAt = paidDate && current.paid_at && dateISOFromEpoch(new Date(current.paid_at).getTime()) === paidDate;
    await db.update("expenses", id, {
      category_id: str(fd, "category_id"),
      description,
      amount,
      incurred_on: incurredOn,
      paid_at: paidDate ? (keepPaidAt ? current.paid_at : instantOf(paidDate)) : null,
      is_recurring: bool(fd, "is_recurring"),
      notes: optStr(fd, "notes"),
    });
    return "Alterações salvas.";
  }, PATHS);
}

export async function payExpenseAction(fd: FormData): Promise<void> {
  const back = backTo(fd, "/admin/financeiro/despesas");
  const date = str(fd, "date") || todayISO();
  if (!isValidDateISO(date)) redirect(withParam(back, "erro", "Informe uma data válida."));
  if (date > todayISO()) redirect(withParam(back, "erro", "A data do pagamento não pode estar no futuro."));
  const res = await guarded((db) => db.update("expenses", str(fd, "id"), { paid_at: instantOf(date) }).then(() => undefined), PATHS);
  redirect(res?.error ? withParam(back, "erro", res.error) : withParam(back, "aviso", "Pagamento registrado.", ["pagar"]));
}

export async function unpayExpenseAction(fd: FormData): Promise<void> {
  const back = backTo(fd, "/admin/financeiro/despesas");
  const res = await guarded((db) => db.update("expenses", str(fd, "id"), { paid_at: null }).then(() => undefined), PATHS);
  redirect(res?.error ? withParam(back, "erro", res.error) : withParam(back, "aviso", "Pagamento desfeito: a despesa voltou para “a pagar”."));
}

export async function deleteExpenseAction(fd: FormData): Promise<void> {
  const res = await guarded((db) => db.remove("expenses", str(fd, "id")), PATHS);
  redirect(res?.error ? withParam(backTo(fd, "/admin/financeiro/despesas"), "erro", res.error) : "/admin/financeiro/despesas");
}

/** Repete no mês as despesas marcadas como recorrentes (regra em generate_recurring_expenses). */
export async function generateRecurringAction(fd: FormData): Promise<void> {
  const month = str(fd, "month");
  const back = backTo(fd, "/admin/financeiro/despesas");
  if (!isMonth(month)) redirect(withParam(back, "erro", "Mês inválido."));
  let created = 0;
  const res = await guarded(async (db) => {
    created = await db.rpc<number>("generate_recurring_expenses", { p_month: `${month}-01` });
  }, PATHS);
  if (res?.error) redirect(withParam(back, "erro", res.error));
  redirect(withParam(back, "aviso", created === 0 ? "Nada a repetir: as despesas recorrentes já estão neste mês (ou nenhuma foi marcada como recorrente)." : `${created} despesa${created === 1 ? "" : "s"} recorrente${created === 1 ? "" : "s"} criada${created === 1 ? "" : "s"} para este mês, a pagar.`));
}

// ---------------------------------------------------------------------------
// Categorias de despesa
// ---------------------------------------------------------------------------

export async function saveCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "name");
  if (name.length < 2) return { error: "Dê um nome à categoria." };
  const kind = str(fd, "kind");
  if (kind !== "fixed" && kind !== "variable") return { error: "Escolha se a categoria é fixa ou variável." };
  return guarded(async (db) => {
    await db.insert("expense_categories", { name, kind, active: true });
    return "Categoria criada.";
  }, PATHS);
}

export async function toggleCategoryAction(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  await guarded(async (db) => {
    const c = await db.get("expense_categories", id);
    if (c) await db.update("expense_categories", id, { active: !c.active });
  }, PATHS);
  redirect("/admin/financeiro/despesas#categorias");
}
