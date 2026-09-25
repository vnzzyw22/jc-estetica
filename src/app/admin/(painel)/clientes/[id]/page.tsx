import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteClientAction, saveClientAction } from "@/app/admin/(painel)/clientes/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { AgendaTab } from "@/components/admin/client/agenda-tab";
import { AnamnesisTab } from "@/components/admin/client/anamnesis-tab";
import { Timeline } from "@/components/admin/client/timeline";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ScreeningData } from "@/components/admin/screening-data";
import { Empty, Field, PageTitle } from "@/components/admin/ui";
import { StageChip } from "@/components/admin/stage-chip";
import { requireAdmin } from "@/lib/auth";
import { loadClientFile } from "@/lib/client-file";
import { dateTimeLabel, nowISO, todayISO } from "@/lib/date";
import { maskPhone } from "@/lib/format";
import { labels } from "@/lib/screening";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata = { title: "Cliente" };

const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "triagem", label: "Triagem" },
  { key: "anamnese", label: "Anamnese" },
  { key: "agenda", label: "Agenda" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Search = Promise<{ aba?: string; id?: string; erro?: string }>;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-linha py-3">
      <dt className="t-small">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

export default async function ClientFilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const file = await loadClientFile(db, id, Date.parse(nowISO()));
  if (!file) notFound();

  const { client, screenings, anamneses, appointments, treatments } = file;
  const tab: Tab = TABS.some((t) => t.key === sp.aba) ? (sp.aba as Tab) : "resumo";
  const nowMs = Date.parse(nowISO());
  const wa = whatsappLink(client.phone);
  const erro = sp.erro ? sp.erro.slice(0, 200) : null;

  const upcoming = appointments.filter((a) => a.status !== "cancelled" && new Date(a.starts_at).getTime() >= nowMs).sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1))[0];
  const lastDone = appointments.find((a) => a.status === "completed");
  const draft = anamneses.find((a) => a.status === "draft");
  const lastCompleted = anamneses.find((a) => a.status === "completed");
  const activeTreatments = treatments.filter((t) => t.status === "active" || t.status === "paused").length;

  const [services, terms] = await Promise.all([tab === "agenda" ? db.list("services", { eq: { active: true }, order: [["display_order", "asc"]] }) : Promise.resolve([]), tab === "triagem" ? db.list("consent_terms") : Promise.resolve([])]);
  const termById = new Map(terms.map((t) => [t.id, t]));

  // `short` é o que cabe no celular; `full` aparece a partir de sm.
  const counts: Record<Tab, { short: string; full: string } | null> = {
    resumo: null,
    triagem: screenings.length ? { short: String(screenings.length), full: String(screenings.length) } : null,
    anamnese: draft ? { short: "•", full: "rascunho" } : lastCompleted ? { short: "", full: "concluída" } : null,
    agenda: appointments.length ? { short: String(appointments.length), full: String(appointments.length) } : null,
  };

  return (
    <>
      <PageTitle title={client.name}>
        <Link href="/admin/clientes" className="link-draw text-[0.9rem]">
          Voltar à lista
        </Link>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost">
            WhatsApp
          </a>
        )}
        <Link href={`/admin/clientes/${client.id}?aba=agenda`} className="btn btn-sm">
          Novo agendamento
        </Link>
      </PageTitle>

      <div className="-mt-3 mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.95rem]">
        <StageChip stage={file.stage} />
        <span className="tnum">{maskPhone(client.phone)}</span>
        {client.email && <span className="text-cafe">{client.email}</span>}
        <span className="t-small">
          Cliente desde <span className="tnum">{dateTimeLabel(client.created_at).split(" às")[0]}</span>
        </span>
      </div>

      <nav aria-label="Seções da ficha" className="no-scrollbar -mx-[var(--spacing-gutter)] mb-10 flex gap-x-4 text-[0.95rem] sm:gap-x-7 sm:text-base overflow-x-auto border-b border-linha px-[var(--spacing-gutter)] lg:mx-0 lg:px-0">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link key={t.key} href={`/admin/clientes/${client.id}?aba=${t.key}`} aria-current={active ? "page" : undefined} className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 transition-colors ${active ? "border-bisturi font-medium text-bisturi" : "border-transparent text-cafe hover:text-espresso"}`}>
              {t.label}
              {counts[t.key] && (
                <span className="tnum text-[0.8125rem]">
                  <span className="sm:hidden" aria-hidden={!counts[t.key]!.short}>{counts[t.key]!.short}</span>
                  <span className="hidden sm:inline">{counts[t.key]!.full}</span>
                  {t.key === "anamnese" && <span className="sr-only sm:hidden">{counts[t.key]!.full}</span>}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {erro && (
        <p role="alert" className="mb-8 max-w-[64ch] border-l-2 border-alerta bg-alerta/5 px-4 py-3 text-[0.95rem] text-alerta">
          {erro}
        </p>
      )}

      {tab === "resumo" && (
        <div className="grid gap-x-12 gap-y-12 xl:grid-cols-2">
          <div className="grid content-start gap-12">
            <section aria-labelledby="resumo-fatos">
              <h2 id="resumo-fatos" className="t-h3 mb-4">
                Em resumo
              </h2>
              <dl className="tnum border-t border-linha">
                <Fact label="Próximo agendamento">
                  {upcoming ? (
                    <Link href={`/admin/agendamentos/${upcoming.id}`} className="link-draw">
                      {dateTimeLabel(upcoming.starts_at)}
                    </Link>
                  ) : (
                    "Nenhum"
                  )}
                </Fact>
                <Fact label="Último atendimento">{lastDone ? dateTimeLabel(lastDone.starts_at) : "Nenhum ainda"}</Fact>
                <Fact label="Triagem mais recente">
                  {screenings[0] ? (
                    <Link href={`/admin/triagens/${screenings[0].id}`} className="link-draw">
                      {labels.status(screenings[0].status)}
                    </Link>
                  ) : (
                    "Não enviou"
                  )}
                </Fact>
                <Fact label="Anamnese">
                  {draft ? (
                    <Link href={`/admin/clientes/${client.id}?aba=anamnese&id=${draft.id}`} className="link-draw">
                      Em rascunho
                    </Link>
                  ) : lastCompleted ? (
                    `Concluída em ${(lastCompleted.assessed_at ?? lastCompleted.created_at).slice(0, 10).split("-").reverse().join("/")}`
                  ) : (
                    "Não iniciada"
                  )}
                </Fact>
                <Fact label="Tratamentos ativos">{activeTreatments}</Fact>
              </dl>
            </section>

            <section aria-labelledby="dados">
              <h2 id="dados" className="t-h3 mb-4">
                Dados de contato
              </h2>
              <AdminForm action={saveClientAction} className="grid max-w-lg gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={client.id} />
                <Field label="Nome">
                  <input name="name" defaultValue={client.name} className="field" required />
                </Field>
                <Field label="Telefone com DDD">
                  <input name="phone" defaultValue={client.phone} className="field" inputMode="tel" required />
                </Field>
                <Field label="E-mail" className="sm:col-span-2">
                  <input name="email" type="email" defaultValue={client.email ?? ""} className="field" />
                </Field>
                <Field label="Observações" className="sm:col-span-2">
                  <textarea name="notes" defaultValue={client.notes ?? ""} rows={4} className="field" />
                </Field>
              </AdminForm>

              <form action={deleteClientAction} className="mt-10">
                <input type="hidden" name="id" value={client.id} />
                <ConfirmButton confirm="Excluir esta cliente? Só é possível se ela não tiver agendamentos, triagens, anamneses ou tratamentos." className="link-draw text-[0.9rem] text-alerta">
                  Excluir cliente
                </ConfirmButton>
              </form>
            </section>
          </div>

          <section aria-labelledby="linha">
            <h2 id="linha" className="t-h3 mb-4">
              Linha do tempo
            </h2>
            <Timeline items={file.timeline} />
          </section>
        </div>
      )}

      {tab === "triagem" && (
        <section aria-label="Triagens da cliente" className="grid gap-14">
          {screenings.length === 0 ? (
            <Empty>Esta cliente não enviou triagem. Ela chegou por agendamento direto ou cadastro manual.</Empty>
          ) : (
            screenings.map((s) => (
              <article key={s.id} aria-labelledby={`t-${s.id}`}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-4">
                  <h2 id={`t-${s.id}`} className="t-h3">
                    {labels.status(s.status)}
                  </h2>
                  <Link href={`/admin/triagens/${s.id}`} className="link-draw text-[0.9rem] font-medium">
                    Mudar estado e observações
                  </Link>
                </div>
                <div className="max-w-3xl">
                  <ScreeningData screening={s} compact term={s.consent_term_id ? (termById.get(s.consent_term_id) ?? null) : null} />
                </div>
                {s.internal_notes && (
                  <p className="mt-4 max-w-3xl whitespace-pre-line border-l-2 border-rose pl-4 text-[0.95rem]">
                    <span className="t-small block">Observações internas</span>
                    {s.internal_notes}
                  </p>
                )}
              </article>
            ))
          )}
        </section>
      )}

      {tab === "anamnese" && <AnamnesisTab file={file} selectedId={sp.id} today={todayISO()} />}
      {tab === "agenda" && <AgendaTab file={file} services={services} nowMs={nowMs} />}
    </>
  );
}
