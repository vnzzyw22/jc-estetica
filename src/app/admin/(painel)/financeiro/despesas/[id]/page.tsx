import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteExpenseAction, unpayExpenseAction } from "@/app/admin/(painel)/financeiro/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ExpenseForm } from "@/components/admin/finance/expense-form";
import { ExpenseChip } from "@/components/admin/finance/finance-chip";
import { Notice } from "@/components/admin/finance/notice";
import { requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/date";
import { loadCategories } from "@/lib/finance-data";
import { formatMoney } from "@/lib/format";

export const metadata = { title: "Despesa" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; aviso?: string }> };

export default async function ExpenseDetailPage({ params, searchParams }: Props) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const expense = await db.get("expenses", id).catch(() => null);
  if (!expense) notFound();

  const categories = await loadCategories(db);
  const here = `/admin/financeiro/despesas/${expense.id}`;
  const paid = expense.paid_at !== null;

  return (
    <>
      <Notice erro={sp.erro} aviso={sp.aviso} />
      <p className="mb-6">
        <Link href="/admin/financeiro/despesas" className="link-draw text-[0.9rem]">
          Voltar às despesas
        </Link>
      </p>

      <h2 className="t-h2">{expense.description}</h2>
      <div className="mt-3 mb-10 flex flex-wrap items-center gap-3">
        <ExpenseChip paid={paid} overdue={!paid && expense.incurred_on < todayISO()} />
        <span className="tnum">{formatMoney(expense.amount)}</span>
      </div>

      <div className="grid gap-x-12 gap-y-12 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <ExpenseForm categories={categories} expense={expense} />

        <div className="grid content-start gap-6">
          {paid && (
            <form action={unpayExpenseAction}>
              <input type="hidden" name="id" value={expense.id} />
              <input type="hidden" name="back" value={here} />
              <ConfirmButton confirm="Desfazer o pagamento? A despesa volta para “a pagar”.">Desfazer pagamento</ConfirmButton>
            </form>
          )}
          <form action={deleteExpenseAction}>
            <input type="hidden" name="id" value={expense.id} />
            <input type="hidden" name="back" value={here} />
            <ConfirmButton confirm="Excluir esta despesa definitivamente?" className="link-draw text-[0.9rem] text-alerta">
              Excluir despesa
            </ConfirmButton>
          </form>
        </div>
      </div>
    </>
  );
}
