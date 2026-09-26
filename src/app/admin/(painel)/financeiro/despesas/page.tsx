import Link from "next/link";
import { generateRecurringAction, saveCategoryAction, toggleCategoryAction } from "@/app/admin/(painel)/financeiro/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ExpenseForm } from "@/components/admin/finance/expense-form";
import { ExpenseRow } from "@/components/admin/finance/expense-row";
import { MonthSwitch } from "@/components/admin/finance/month-switch";
import { Notice } from "@/components/admin/finance/notice";
import { Empty, Field } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/date";
import { isMonth, queryString, sumMoney } from "@/lib/finance";
import { loadCategories, loadMonthExpenses, loadOverdueExpenses } from "@/lib/finance-data";
import { EXPENSE_KIND_LABEL, formatMoney } from "@/lib/format";

export const metadata = { title: "Despesas" };

const FILTERS = [
  { value: "todas", label: "Todas" },
  { value: "apagar", label: "A pagar" },
  { value: "pagas", label: "Pagas" },
  { value: "atrasadas", label: "Atrasadas" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

type Search = Promise<{ mes?: string; filtro?: string; pagar?: string; novo?: string; erro?: string; aviso?: string }>;

const PATH = "/admin/financeiro/despesas";

export default async function ExpensesPage({ searchParams }: { searchParams: Search }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const currentMonth = today.slice(0, 7);
  const month = isMonth(sp.mes) ? sp.mes : currentMonth;
  const filter: Filter = FILTERS.some((f) => f.value === sp.filtro) ? (sp.filtro as Filter) : "todas";
  const monthParam = month === currentMonth ? undefined : month;

  const [monthList, overdue, categories] = await Promise.all([loadMonthExpenses(db, month), loadOverdueExpenses(db, today), loadCategories(db)]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const counts: Record<Filter, number> = {
    todas: monthList.length,
    apagar: monthList.filter((e) => e.paid_at === null).length,
    pagas: monthList.filter((e) => e.paid_at !== null).length,
    atrasadas: overdue.length,
  };
  const visible = filter === "atrasadas" ? overdue : monthList.filter((e) => (filter === "todas" ? true : filter === "apagar" ? e.paid_at === null : e.paid_at !== null));
  const paid = sumMoney(visible.filter((e) => e.paid_at !== null).map((e) => e.amount));
  const toPay = sumMoney(visible.filter((e) => e.paid_at === null).map((e) => e.amount));

  const listHref = (extra: Record<string, string | undefined> = {}) => `${PATH}${queryString({ mes: filter === "atrasadas" ? undefined : monthParam, filtro: filter === "todas" ? undefined : filter, ...extra })}`;
  const back = listHref();

  return (
    <>
      <Notice erro={sp.erro} aviso={sp.aviso} />

      <details className="mb-10 border border-linha px-5 py-4" open={sp.novo === "1"}>
        <summary className="cursor-pointer font-medium">Nova despesa</summary>
        <div className="mt-5">
          <ExpenseForm categories={categories} />
        </div>
      </details>

      <nav aria-label="Filtrar despesas" className="no-scrollbar -mx-[var(--spacing-gutter)] mb-6 flex gap-x-6 overflow-x-auto px-[var(--spacing-gutter)] lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`${PATH}${queryString({ mes: f.value === "atrasadas" ? undefined : monthParam, filtro: f.value === "todas" ? undefined : f.value })}`}
            aria-current={f.value === filter ? "true" : undefined}
            className={`link-draw flex min-h-11 shrink-0 items-center gap-2 ${f.value === filter ? "font-medium text-bisturi" : "text-cafe"}`}
          >
            {f.label}
            <span className="tnum text-[0.8125rem]">{counts[f.value]}</span>
          </Link>
        ))}
      </nav>

      {filter === "atrasadas" ? (
        <p className="t-small mb-8 max-w-[60ch]">Todos os meses: despesas com data anterior a hoje que ainda não foram pagas.</p>
      ) : (
        <>
          <MonthSwitch month={month} path={PATH} keep={{ filtro: filter === "todas" ? undefined : filter }} />
          <form action={generateRecurringAction} className="-mt-3 mb-8">
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="back" value={back} />
            <ConfirmButton confirm="Criar, neste mês, as despesas marcadas como recorrentes que ainda não estão nele?" className="link-draw text-[0.9rem]">
              Repetir despesas recorrentes neste mês
            </ConfirmButton>
          </form>
        </>
      )}

      {visible.length > 0 && (
        <p className="tnum t-small mb-4">
          {visible.length} {visible.length === 1 ? "despesa" : "despesas"}
          {paid > 0 && <> · paga {formatMoney(paid)}</>}
          {toPay > 0 && <> · a pagar {formatMoney(toPay)}</>}
        </p>
      )}

      {visible.length === 0 ? (
        <Empty>{filter === "atrasadas" ? "Nenhuma despesa atrasada." : "Nenhuma despesa neste filtro e mês."}</Empty>
      ) : (
        <ul className="border-t border-linha">
          {visible.map((e) => (
            <ExpenseRow key={e.id} e={e} category={categoryById.get(e.category_id)} today={today} back={back} payHref={listHref({ pagar: e.id })} paying={sp.pagar === e.id} />
          ))}
        </ul>
      )}

      <section id="categorias" aria-labelledby="categorias-titulo" className="mt-20 max-w-3xl">
        <h2 id="categorias-titulo" className="t-h3 mb-2">
          Categorias
        </h2>
        <p className="t-small mb-4 max-w-[60ch]">Fixas repetem todo mês (aluguel, internet). Variáveis mudam conforme o uso (produtos, materiais). Categorias com despesas não são apagadas, só desativadas.</p>
        <ul className="border-t border-linha">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-linha py-3">
              <span className={c.active ? "" : "text-cafe/60 line-through"}>
                {c.name} <span className="t-small">{EXPENSE_KIND_LABEL[c.kind].toLowerCase()}</span>
              </span>
              <form action={toggleCategoryAction}>
                <input type="hidden" name="id" value={c.id} />
                <ConfirmButton>{c.active ? "Desativar" : "Reativar"}</ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        <AdminForm action={saveCategoryAction} submitLabel="Adicionar categoria" resetOnSuccess className="mt-6 grid max-w-lg gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <input name="name" maxLength={80} required className="field" />
          </Field>
          <Field label="Tipo">
            <select name="kind" defaultValue="variable" className="field">
              <option value="fixed">Fixa</option>
              <option value="variable">Variável</option>
            </select>
          </Field>
        </AdminForm>
      </section>
    </>
  );
}
