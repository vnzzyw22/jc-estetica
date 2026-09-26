import Link from "next/link";
import { Notice } from "@/components/admin/finance/notice";
import { ProgressLine, TreatmentChip } from "@/components/admin/treatment/chips";
import { Empty, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { dateTimeLabel, nowISO } from "@/lib/date";
import { queryString } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { BILLING_LABEL } from "@/lib/treatment";
import { loadTreatmentOverview } from "@/lib/treatment-data";

export const metadata = { title: "Tratamentos" };

const FILTERS = [
  { value: "abertos", label: "Em aberto" },
  { value: "proposed", label: "Propostos" },
  { value: "active", label: "Em andamento" },
  { value: "paused", label: "Pausados" },
  { value: "completed", label: "Concluídos" },
  { value: "cancelled", label: "Cancelados" },
  { value: "todos", label: "Todos" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

const OPEN = ["proposed", "active", "paused"];
type Search = Promise<{ filtro?: string; erro?: string; aviso?: string }>;

export default async function TreatmentsPage({ searchParams }: { searchParams: Search }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === sp.filtro) ? (sp.filtro as Filter) : "abertos";

  const now = Date.parse(nowISO());
  const rows = await loadTreatmentOverview(db);
  const count = (f: Filter) => (f === "todos" ? rows.length : f === "abertos" ? rows.filter((r) => OPEN.includes(r.treatment.status)).length : rows.filter((r) => r.treatment.status === f).length);
  const visible = rows.filter((r) => (filter === "todos" ? true : filter === "abertos" ? OPEN.includes(r.treatment.status) : r.treatment.status === filter));
  // Em andamento primeiro; depois quem tem sessão marcada mais cedo.
  const rank = (status: string) => {
    const i = ["active", "paused", "proposed"].indexOf(status);
    return i === -1 ? 9 : i;
  };
  visible.sort((a, b) => rank(a.treatment.status) - rank(b.treatment.status) || (a.nextAt ?? "9").localeCompare(b.nextAt ?? "9"));

  return (
    <>
      <PageTitle title="Tratamentos">
        <Link href="/admin/pacotes" className="btn btn-sm btn-ghost">
          Pacotes
        </Link>
      </PageTitle>
      <Notice erro={sp.erro} aviso={sp.aviso} />

      <nav aria-label="Filtrar tratamentos" className="no-scrollbar -mx-[var(--spacing-gutter)] mb-8 flex gap-x-6 overflow-x-auto px-[var(--spacing-gutter)] lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/tratamentos${queryString({ filtro: f.value === "abertos" ? undefined : f.value })}`}
            aria-current={f.value === filter ? "true" : undefined}
            className={`link-draw flex min-h-11 shrink-0 items-center gap-2 ${f.value === filter ? "font-medium text-bisturi" : "text-cafe"}`}
          >
            {f.label}
            <span className="tnum text-[0.8125rem]">{count(f.value)}</span>
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <Empty>
          {rows.length === 0 ? (
            <>
              Nenhum tratamento ainda. Comece pelo <Link href="/admin/pacotes" className="link-draw">catálogo de pacotes</Link> e proponha um tratamento na ficha de uma cliente (aba Tratamentos).
            </>
          ) : (
            "Nenhum tratamento neste filtro."
          )}
        </Empty>
      ) : (
        <ul className="border-t border-linha">
          {visible.map(({ treatment: t, client, progress, nextAt }) => (
            <li key={t.id} className="border-b border-linha">
              <Link href={`/admin/tratamentos/${t.id}`} className="grid gap-x-6 gap-y-2 px-1 py-4 transition-colors hover:bg-seda/60 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_8.5rem] lg:items-baseline">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="t-small block truncate">
                    {client?.name ?? "Cliente removida"} · {BILLING_LABEL[t.billing_mode].toLowerCase()}
                    {t.billing_mode === "package" && t.price_total !== null ? `, ${formatMoney(t.price_total)}` : ""}
                  </span>
                </span>
                <span>{progress.total > 0 ? <ProgressLine progress={progress} compact /> : <span className="t-small">{t.total_sessions} sessões previstas</span>}</span>
                <span className={`tnum t-small ${nextAt && Date.parse(nextAt) < now ? "text-alerta" : ""}`}>
                  {nextAt ? (Date.parse(nextAt) < now ? `Passou em ${dateTimeLabel(nextAt)}: falta marcar como realizada` : `Próxima: ${dateTimeLabel(nextAt)}`) : t.status === "active" ? "Sem sessão marcada" : ""}
                </span>
                <span className="lg:text-right">
                  <TreatmentChip status={t.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
