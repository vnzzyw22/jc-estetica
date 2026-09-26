import Link from "next/link";
import { payExpenseAction, unpayExpenseAction } from "@/app/admin/(painel)/financeiro/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ExpenseChip } from "@/components/admin/finance/finance-chip";
import { Field } from "@/components/admin/ui";
import { dateBR } from "@/lib/date";
import { EXPENSE_KIND_LABEL, formatMoney } from "@/lib/format";
import { expenseDate } from "@/lib/finance-data";
import type { Expense, ExpenseCategory } from "@/lib/types";

interface ExpenseRowProps {
  e: Expense;
  category: ExpenseCategory | undefined;
  today: string;
  back: string;
  payHref: string;
  paying: boolean;
}

/** Uma linha de despesa: o quê, categoria, data, valor, estado, e pagar ou desfazer. */
export function ExpenseRow({ e, category, today, back, payHref, paying }: ExpenseRowProps) {
  const paid = e.paid_at !== null;
  const overdue = !paid && e.incurred_on < today;

  return (
    <li className="border-b border-linha py-4">
      <div className="grid gap-x-6 gap-y-1 lg:grid-cols-[minmax(0,1fr)_11rem_8rem_6.5rem] lg:items-baseline">
        <div className="min-w-0">
          <Link href={`/admin/financeiro/despesas/${e.id}`} className="link-draw font-medium">
            {e.description}
          </Link>
          {e.is_recurring && <span className="t-small ml-2">recorrente</span>}
          <p className="t-small truncate">
            {category ? `${category.name}, ${EXPENSE_KIND_LABEL[category.kind].toLowerCase()}` : "Sem categoria"}
          </p>
        </div>
        <p className="t-small tnum">{paid ? `Paga em ${dateBR(expenseDate(e))}` : `Data ${dateBR(e.incurred_on)}`}</p>
        <p className="tnum font-medium lg:text-right">{formatMoney(e.amount)}</p>
        <div className="lg:text-right">
          <ExpenseChip paid={paid} overdue={overdue} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-5">
        {!paid && (
          <Link href={payHref} scroll={false} className="link-draw min-h-9 text-[0.9rem] font-medium text-bisturi">
            Pagar
          </Link>
        )}
        {paid && (
          <form action={unpayExpenseAction}>
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="back" value={back} />
            <ConfirmButton confirm="Desfazer o pagamento? A despesa volta para “a pagar”.">Desfazer pagamento</ConfirmButton>
          </form>
        )}
        <Link href={`/admin/financeiro/despesas/${e.id}`} className="link-draw min-h-9 text-[0.9rem]">
          Editar
        </Link>
      </div>

      {paying && !paid && (
        <form action={payExpenseAction} className="mt-4 grid max-w-xl items-end gap-4 border-l-2 border-bisturi pl-4 sm:grid-cols-[1fr_auto]">
          <input type="hidden" name="id" value={e.id} />
          <input type="hidden" name="back" value={back} />
          <Field label="Data do pagamento">
            <input type="date" name="date" defaultValue={today} max={today} required className="field tnum" />
          </Field>
          <div className="flex items-center gap-4">
            <button type="submit" className="btn btn-sm">
              Confirmar
            </button>
            <Link href={back} scroll={false} className="link-draw text-[0.9rem]">
              Fechar
            </Link>
          </div>
        </form>
      )}
    </li>
  );
}
