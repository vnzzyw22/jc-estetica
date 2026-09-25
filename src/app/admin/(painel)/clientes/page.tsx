import Link from "next/link";
import { saveClientAction } from "@/app/admin/(painel)/clientes/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { StageChip } from "@/components/admin/stage-chip";
import { Empty, Field, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { STAGE_LABEL, clientStage, type ClientStage } from "@/lib/client-stage";
import { digitsOnly, maskPhone } from "@/lib/format";

export const metadata = { title: "Clientes" };

const STAGES = Object.keys(STAGE_LABEL) as ClientStage[];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; etapa?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const etapa = STAGES.includes(sp.etapa as ClientStage) ? (sp.etapa as ClientStage) : undefined;

  const [clients, appointments, screenings, treatments] = await Promise.all([db.list("clients", { order: [["name", "asc"]] }), db.list("appointments"), db.list("screenings"), db.list("treatments")]);

  const group = <T extends { client_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.client_id, [...(m.get(r.client_id) ?? []), r]);
    return m;
  };
  const apptBy = group(appointments);
  const scrBy = group(screenings);
  const trBy = group(treatments);

  const enriched = clients.map((c) => ({
    c,
    stage: clientStage({ screenings: scrBy.get(c.id) ?? [], treatments: trBy.get(c.id) ?? [], appointments: apptBy.get(c.id) ?? [] }),
    total: (apptBy.get(c.id) ?? []).filter((a) => a.status !== "cancelled").length,
  }));

  const counts = new Map<ClientStage, number>();
  for (const e of enriched) counts.set(e.stage, (counts.get(e.stage) ?? 0) + 1);

  const digits = digitsOnly(q);
  const filtered = enriched.filter(({ c, stage }) => (!etapa || stage === etapa) && (!q || c.name.toLowerCase().includes(q) || (digits && c.phone.includes(digits)) || c.email?.toLowerCase().includes(q)));

  const href = (next: { etapa?: string; q?: string }) => {
    const p = new URLSearchParams();
    if (next.etapa) p.set("etapa", next.etapa);
    if (next.q) p.set("q", next.q);
    return `/admin/clientes${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageTitle title="Clientes" />

      <nav aria-label="Filtrar por etapa" className="mb-6 flex flex-wrap gap-x-6">
        {[{ value: undefined, label: "Todas" }, ...STAGES.map((s) => ({ value: s as string | undefined, label: STAGE_LABEL[s] }))].map((o) => {
          const active = o.value === etapa;
          const n = o.value ? (counts.get(o.value as ClientStage) ?? 0) : clients.length;
          return (
            <Link key={o.label} href={href({ etapa: o.value, q })} aria-current={active ? "true" : undefined} className={`link-draw flex min-h-11 items-center gap-2 ${active ? "font-medium text-bisturi" : "text-cafe"}`}>
              {o.label}
              <span className="tnum text-[0.8125rem]">{n}</span>
            </Link>
          );
        })}
      </nav>

      <form method="get" className="mb-8 flex max-w-md gap-3">
        {etapa && <input type="hidden" name="etapa" value={etapa} />}
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nome, telefone ou e-mail…" aria-label="Buscar clientes" className="field" />
        <button type="submit" className="btn btn-sm btn-ghost">
          Buscar
        </button>
      </form>

      {filtered.length === 0 ? (
        <Empty>{q || etapa ? "Nenhuma cliente neste filtro." : "Nenhuma cliente ainda. Elas aparecem aqui quando enviam a triagem ou agendam pelo site."}</Empty>
      ) : (
        <ul className="border-t border-linha">
          {filtered.map(({ c, stage, total }) => (
            <li key={c.id} className="border-b border-linha">
              <Link href={`/admin/clientes/${c.id}`} className="grid items-baseline gap-x-6 gap-y-1 px-1 py-3.5 transition-colors hover:bg-seda/60 md:grid-cols-[1fr_9rem_10rem_7rem]">
                <span className="font-medium">{c.name}</span>
                <span className="tnum text-cafe">{maskPhone(c.phone)}</span>
                <span>
                  <StageChip stage={stage} />
                </span>
                <span className="t-small md:text-right">{total} agendamento(s)</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-12 max-w-2xl border border-linha px-5 py-4">
        <summary className="cursor-pointer font-medium">Cadastrar cliente</summary>
        <AdminForm action={saveClientAction} submitLabel="Cadastrar" resetOnSuccess className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <input name="name" className="field" required />
          </Field>
          <Field label="Telefone com DDD">
            <input name="phone" className="field" inputMode="tel" required />
          </Field>
          <Field label="E-mail (opcional)">
            <input name="email" type="email" className="field" />
          </Field>
          <Field label="Observações">
            <input name="notes" className="field" />
          </Field>
        </AdminForm>
      </details>
    </>
  );
}
