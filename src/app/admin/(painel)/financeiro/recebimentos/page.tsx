import Link from "next/link";
import { MonthSwitch } from "@/components/admin/finance/month-switch";
import { Notice } from "@/components/admin/finance/notice";
import { PaymentRow } from "@/components/admin/finance/payment-row";
import { ReceivableForm, type ReceivablePrefill } from "@/components/admin/finance/receivable-form";
import { Empty } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { dateBR, dateISOFromEpoch, todayISO } from "@/lib/date";
import { isMonth, paymentView, queryString, sumMoney } from "@/lib/finance";
import { loadClientMap, loadMonthPayments, loadOverduePayments } from "@/lib/finance-data";
import { KIND_LABEL, formatMoney } from "@/lib/format";

export const metadata = { title: "Recebimentos" };

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "areceber", label: "A receber" },
  { value: "recebidos", label: "Recebidos" },
  { value: "atrasados", label: "Atrasados" },
  { value: "cancelados", label: "Cancelados" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

type Search = Promise<{ mes?: string; filtro?: string; receber?: string; novo?: string; cliente?: string; tratamento?: string; atendimento?: string; erro?: string; aviso?: string }>;

const PATH = "/admin/financeiro/recebimentos";

/** Preenche o formulário a partir do que a URL aponta, sempre relendo do banco (a URL só carrega o id). */
async function buildPrefill(db: Awaited<ReturnType<typeof requireAdmin>>["db"], sp: Awaited<Search>): Promise<ReceivablePrefill> {
  const prefill: ReceivablePrefill = { clientId: sp.cliente };
  if (sp.tratamento) {
    const t = await db.get("treatments", sp.tratamento).catch(() => null);
    if (t) Object.assign(prefill, { clientId: t.client_id, treatmentId: t.id, description: t.name });
  }
  if (sp.atendimento) {
    const a = await db.get("appointments", sp.atendimento).catch(() => null);
    if (a) {
      const service = a.service_id ? await db.get("services", a.service_id) : null;
      const name = service?.name ?? KIND_LABEL[a.kind];
      Object.assign(prefill, {
        clientId: a.client_id,
        appointmentId: a.id,
        appointmentLabel: `${name}, ${dateBR(dateISOFromEpoch(Date.parse(a.starts_at)))}`,
        description: name,
        amount: service?.price != null ? String(service.price).replace(".", ",") : undefined,
      });
    }
  }
  return prefill;
}

export default async function ReceivablesPage({ searchParams }: { searchParams: Search }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const currentMonth = today.slice(0, 7);
  const month = isMonth(sp.mes) ? sp.mes : currentMonth;
  const filter: Filter = FILTERS.some((f) => f.value === sp.filtro) ? (sp.filtro as Filter) : "todos";
  const monthParam = month === currentMonth ? undefined : month;

  const [monthList, overdue, clients, treatments] = await Promise.all([
    loadMonthPayments(db, month),
    loadOverduePayments(db, today),
    loadClientMap(db),
    db.list("treatments", { order: [["proposed_at", "desc"]] }),
  ]);

  const counts: Record<Filter, number> = {
    todos: monthList.length,
    areceber: monthList.filter((p) => p.status === "pending").length,
    recebidos: monthList.filter((p) => p.status === "paid").length,
    atrasados: overdue.length,
    cancelados: monthList.filter((p) => p.status === "cancelled" || p.status === "refunded").length,
  };

  const visible =
    filter === "atrasados"
      ? overdue
      : monthList.filter((p) => (filter === "todos" ? true : filter === "areceber" ? p.status === "pending" : filter === "recebidos" ? p.status === "paid" : p.status === "cancelled" || p.status === "refunded"));

  const received = sumMoney(visible.filter((p) => p.status === "paid").map((p) => p.amount));
  const toReceive = sumMoney(visible.filter((p) => p.status === "pending").map((p) => p.amount));

  const listHref = (extra: Record<string, string | undefined> = {}) => `${PATH}${queryString({ mes: filter === "atrasados" ? undefined : monthParam, filtro: filter === "todos" ? undefined : filter, ...extra })}`;
  const back = listHref();
  const prefill = await buildPrefill(db, sp);
  const formOpen = sp.novo === "1" || Boolean(sp.cliente || sp.tratamento || sp.atendimento);

  return (
    <>
      <Notice erro={sp.erro} aviso={sp.aviso} />

      <details className="mb-10 border border-linha px-5 py-4" open={formOpen}>
        <summary className="cursor-pointer font-medium">Novo recebimento</summary>
        <div className="mt-5">
          <ReceivableForm clients={[...clients.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))} treatments={treatments.filter((t) => t.status !== "cancelled")} prefill={prefill} />
        </div>
      </details>

      <nav aria-label="Filtrar recebimentos" className="no-scrollbar -mx-[var(--spacing-gutter)] mb-6 flex gap-x-6 overflow-x-auto px-[var(--spacing-gutter)] lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`${PATH}${queryString({ mes: f.value === "atrasados" ? undefined : monthParam, filtro: f.value === "todos" ? undefined : f.value })}`}
            aria-current={f.value === filter ? "true" : undefined}
            className={`link-draw flex min-h-11 shrink-0 items-center gap-2 ${f.value === filter ? "font-medium text-bisturi" : "text-cafe"}`}
          >
            {f.label}
            <span className="tnum text-[0.8125rem]">{counts[f.value]}</span>
          </Link>
        ))}
      </nav>

      {filter === "atrasados" ? (
        <p className="t-small mb-8 max-w-[60ch]">Todos os meses: tudo o que venceu antes de hoje e ainda não foi recebido.</p>
      ) : (
        <MonthSwitch month={month} path={PATH} keep={{ filtro: filter === "todos" ? undefined : filter }} />
      )}

      {visible.length > 0 && (
        <p className="tnum t-small mb-4">
          {visible.length} {visible.length === 1 ? "cobrança" : "cobranças"}
          {received > 0 && <> · recebido {formatMoney(received)}</>}
          {toReceive > 0 && <> · a receber {formatMoney(toReceive)}</>}
        </p>
      )}

      {visible.length === 0 ? (
        <Empty>{filter === "atrasados" ? "Nenhum recebimento atrasado." : "Nenhum recebimento neste filtro e mês."}</Empty>
      ) : (
        <ul className="border-t border-linha">
          {visible.map((p) => (
            <PaymentRow
              key={p.id}
              p={p}
              client={p.client_id ? (clients.get(p.client_id) ?? null) : null}
              today={today}
              back={back}
              receiveHref={listHref({ receber: p.id })}
              receiving={sp.receber === p.id && paymentView(p, today) !== "paid"}
            />
          ))}
        </ul>
      )}
    </>
  );
}
