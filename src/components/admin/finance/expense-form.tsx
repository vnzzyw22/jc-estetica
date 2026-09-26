import { createExpenseAction, updateExpenseAction } from "@/app/admin/(painel)/financeiro/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { Field } from "@/components/admin/ui";
import { todayISO } from "@/lib/date";
import { EXPENSE_KIND_LABEL } from "@/lib/format";
import { expenseDate } from "@/lib/finance-data";
import type { Expense, ExpenseCategory } from "@/lib/types";

/** Categorias agrupadas em fixas e variáveis. Ao editar, a categoria atual aparece mesmo se estiver desativada. */
function CategoryOptions({ categories, current }: { categories: ExpenseCategory[]; current?: string }) {
  const usable = categories.filter((c) => c.active || c.id === current);
  return (
    <>
      {(["fixed", "variable"] as const).map((kind) => {
        const list = usable.filter((c) => c.kind === kind);
        return list.length ? (
          <optgroup key={kind} label={EXPENSE_KIND_LABEL[kind]}>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.active ? "" : " (desativada)"}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </>
  );
}

/** Nova despesa (sem `expense`) ou edição de uma existente. "Pago em" vazio = a pagar. */
export function ExpenseForm({ categories, expense }: { categories: ExpenseCategory[]; expense?: Expense }) {
  const today = todayISO();
  const paidOn = expense?.paid_at ? expenseDate(expense) : "";

  return (
    <AdminForm action={expense ? updateExpenseAction : createExpenseAction} submitLabel={expense ? "Salvar alterações" : "Registrar despesa"} resetOnSuccess={!expense} className="grid max-w-3xl gap-x-5 gap-y-4 sm:grid-cols-2">
      {expense && <input type="hidden" name="id" value={expense.id} />}

      <Field label="Descrição" className="sm:col-span-2">
        <input name="description" defaultValue={expense?.description} maxLength={200} required className="field" />
      </Field>
      <Field label="Categoria">
        <select name="category_id" required defaultValue={expense?.category_id ?? ""} className="field">
          <option value="" disabled>
            Escolha…
          </option>
          <CategoryOptions categories={categories} current={expense?.category_id} />
        </select>
      </Field>
      <Field label="Valor (R$)">
        <input name="amount" inputMode="decimal" defaultValue={expense ? String(expense.amount).replace(".", ",") : ""} placeholder="89,90" required className="field tnum" />
      </Field>
      <Field label="Data da despesa" hint="O mês em que ela pesa no caixa, se ainda não foi paga.">
        <input name="incurred_on" type="date" defaultValue={expense?.incurred_on ?? today} required className="field tnum" />
      </Field>

      {expense ? (
        <Field label="Pago em" hint="Vazio: a despesa fica “a pagar”.">
          <input name="paid_date" type="date" defaultValue={paidOn} max={today} className="field tnum" />
        </Field>
      ) : (
        <fieldset className="grid gap-4">
          <legend className="sr-only">Já paga</legend>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="already_paid" className="mt-1 h-5 w-5 accent-[var(--color-bisturi)]" />
            <span>
              Já foi paga
              <span className="t-small block">Entra no caixa como paga, na data abaixo.</span>
            </span>
          </label>
          <Field label="Data do pagamento" hint="Vazio: usa a data da despesa.">
            <input name="paid_date" type="date" max={today} className="field tnum" />
          </Field>
        </fieldset>
      )}

      <label className="flex items-start gap-3 sm:col-span-2">
        <input type="checkbox" name="is_recurring" defaultChecked={expense?.is_recurring} className="mt-1 h-5 w-5 accent-[var(--color-bisturi)]" />
        <span>
          Recorrente
          <span className="t-small block">Todo mês. Em Despesas, “Repetir recorrentes” cria a do mês seguinte, já a pagar.</span>
        </span>
      </label>
      <Field label="Observações" className="sm:col-span-2">
        <input name="notes" defaultValue={expense?.notes ?? ""} maxLength={400} className="field" />
      </Field>
    </AdminForm>
  );
}
