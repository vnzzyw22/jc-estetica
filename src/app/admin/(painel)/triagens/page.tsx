import Link from "next/link";
import { Empty, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { dateTimeLabel } from "@/lib/date";
import { CATEGORY_SHORT } from "@/lib/format";
import { SCREENING_STATUS, SOURCE_LABEL, labels } from "@/lib/screening";

export const metadata = { title: "Triagens" };

type Search = Promise<{ status?: string; origem?: string }>;

export default async function ScreeningsPage({ searchParams }: { searchParams: Search }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;

  const [screenings, clients] = await Promise.all([db.list("screenings", { order: [["created_at", "desc"]] }), db.list("clients")]);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const status = SCREENING_STATUS.some((s) => s.value === sp.status) ? sp.status : undefined;
  const origem = Object.keys(SOURCE_LABEL).includes(sp.origem ?? "") ? sp.origem : undefined;
  const counts = new Map<string, number>();
  for (const s of screenings) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);

  const visible = screenings.filter((s) => (!status || s.status === status) && (!origem || s.source === origem));
  const href = (next: { status?: string; origem?: string }) => {
    const q = new URLSearchParams();
    if (next.status) q.set("status", next.status);
    if (next.origem) q.set("origem", next.origem);
    return `/admin/triagens${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageTitle title="Triagens" />

      <nav aria-label="Filtrar por estado" className="no-scrollbar -mx-[var(--spacing-gutter)] mb-6 flex gap-x-6 overflow-x-auto px-[var(--spacing-gutter)] lg:mx-0 lg:flex-wrap lg:px-0">
        {[{ value: undefined, label: "Todas" }, ...SCREENING_STATUS].map((s) => {
          const active = (s.value ?? undefined) === status;
          const n = s.value ? (counts.get(s.value) ?? 0) : screenings.length;
          return (
            <Link key={s.label} href={href({ status: s.value, origem })} aria-current={active ? "true" : undefined} className={`link-draw flex min-h-11 shrink-0 items-center gap-2 ${active ? "font-medium text-bisturi" : "text-cafe"}`}>
              {s.label}
              <span className="tnum text-[0.8125rem]">{n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.9rem]">
        <span className="t-small">Origem</span>
        {[{ value: undefined, label: "Todas" }, ...Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))].map((o) => (
          <Link key={o.label} href={href({ status, origem: o.value })} aria-current={(o.value ?? undefined) === origem ? "true" : undefined} className={`link-draw min-h-9 ${(o.value ?? undefined) === origem ? "font-medium text-bisturi" : "text-cafe"}`}>
            {o.label}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <Empty>{screenings.length === 0 ? "Nenhuma triagem ainda. Elas chegam aqui assim que alguém preenche a triagem do site." : "Nenhuma triagem neste filtro."}</Empty>
      ) : (
        <ul className="border-t border-linha">
          {visible.map((s) => {
            const client = clientById.get(s.client_id);
            const isNew = s.status === "new";
            return (
              <li key={s.id} className="border-b border-linha">
                <Link href={`/admin/triagens/${s.id}`} className="grid gap-x-6 gap-y-1 px-1 py-4 transition-colors hover:bg-seda/60 md:grid-cols-[1fr_9rem_9rem] md:items-baseline">
                  <span className="min-w-0">
                    <span className={`block truncate ${isNew ? "font-semibold" : "font-medium"}`}>{client?.name ?? "Cliente removido"}</span>
                    <span className="t-small block truncate">
                      {s.interest_area && s.interest_area !== "not_sure" ? CATEGORY_SHORT[s.interest_area] : (labels.area(s.interest_area) ?? "Área não informada")}
                      {s.goal ? `, ${labels.goal(s.goal) ?? s.goal}` : ""}
                    </span>
                    {s.complaint && <span className="mt-1 line-clamp-2 block text-[0.9rem] text-cafe">{s.complaint}</span>}
                  </span>
                  <span className="text-[0.9rem]">
                    <span className="t-small block">{SOURCE_LABEL[s.source] ?? s.source}</span>
                    <span className="tnum t-small block">{dateTimeLabel(s.created_at)}</span>
                  </span>
                  <span className={`w-fit self-start rounded-ctl border px-2 py-0.5 text-[0.8125rem] ${isNew ? "border-rose text-espresso" : "border-linha text-cafe"}`}>{labels.status(s.status)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
