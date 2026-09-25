import Link from "next/link";
import { notFound } from "next/navigation";
import { scheduleEvaluationAction, updateScreeningAction } from "@/app/admin/(painel)/triagens/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { Field, PageTitle, StatusBadge } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { dateTimeLabel, todayISO } from "@/lib/date";
import { maskPhone } from "@/lib/format";
import { SCREENING_STATUS, SOURCE_LABEL, labels } from "@/lib/screening";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata = { title: "Triagem" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-linha py-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
      <dt className="t-small">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line break-words">{children}</dd>
    </div>
  );
}

export default async function ScreeningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const screening = await db.get("screenings", id);
  if (!screening) notFound();

  const [client, term, evaluations] = await Promise.all([
    db.get("clients", screening.client_id),
    screening.consent_term_id ? db.get("consent_terms", screening.consent_term_id) : Promise.resolve(null),
    db.list("appointments", { eq: { screening_id: id, kind: "evaluation" }, order: [["starts_at", "asc"]] }),
  ]);

  const a = screening.answers as Record<string, unknown>;
  const wa = client ? whatsappLink(client.phone, `Olá, ${client.name}! Recebi a sua triagem. `) : null;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

  return (
    <>
      <PageTitle title={client?.name ?? "Triagem"}>
        <Link href="/admin/triagens" className="link-draw text-[0.9rem]">
          Voltar às triagens
        </Link>
        {client && (
          <Link href={`/admin/clientes/${client.id}`} className="btn btn-sm btn-ghost">
            Ver cliente
          </Link>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
            WhatsApp
          </a>
        )}
      </PageTitle>

      <div className="grid gap-x-12 gap-y-12 xl:grid-cols-[1fr_minmax(0,26rem)]">
        <section aria-labelledby="enviado">
          <h2 id="enviado" className="t-h3 mb-4">
            O que foi enviado
          </h2>
          <dl className="border-t border-linha">
            <Row label="Enviada em">
              <span className="tnum">{dateTimeLabel(screening.created_at)}</span>
            </Row>
            <Row label="Origem">
              {SOURCE_LABEL[screening.source] ?? screening.source}
              {screening.source_detail ? ` (${screening.source_detail})` : ""}
            </Row>
            <Row label="Contato">
              <span className="tnum">{client ? maskPhone(client.phone) : "—"}</span>
              {client?.email ? `\n${client.email}` : ""}
            </Row>
            <Row label="Área">{labels.area(screening.interest_area) ?? "Não informada"}</Row>
            <Row label="Queixa">{screening.complaint ?? "—"}</Row>
            <Row label="Objetivo">{labels.goal(screening.goal) ?? screening.goal ?? "—"}</Row>
            {screening.desired_outcome && <Row label="Resultado imaginado">{screening.desired_outcome}</Row>}
            {labels.duration(a.duration) && <Row label="Há quanto tempo">{labels.duration(a.duration)}</Row>}
            {labels.previous(a.previous_treatment) && <Row label="Tratamento anterior">{labels.previous(a.previous_treatment)}</Row>}
            {text(a.notes) && <Row label="Observação da cliente">{text(a.notes)}</Row>}
            {labels.period(a.preferred_period) && <Row label="Período preferido">{labels.period(a.preferred_period)}</Row>}
            {labels.visits(a.visits_per_month) && <Row label="Vezes por mês">{labels.visits(a.visits_per_month)}</Row>}
            {labels.contact(a.contact_preference) && <Row label="Prefere contato por">{labels.contact(a.contact_preference)}</Row>}
            <Row label="Consentimento">
              {screening.consented_at ? (
                <>
                  Aceito em <span className="tnum">{dateTimeLabel(screening.consented_at)}</span>
                  <br />
                  {term ? `Termo versão ${term.version}` : "Sem termo publicado no momento (ambiente de desenvolvimento)"}
                </>
              ) : (
                "Não registrado"
              )}
            </Row>
          </dl>
        </section>

        <div className="grid content-start gap-12">
          <section aria-labelledby="estado">
            <h2 id="estado" className="t-h3 mb-1">
              Estado e observações
            </h2>
            <p className="t-small mb-4">
              Estado desde <span className="tnum">{dateTimeLabel(screening.status_changed_at)}</span>
            </p>
            <AdminForm action={updateScreeningAction} className="grid gap-4">
              <input type="hidden" name="id" value={screening.id} />
              <Field label="Estado">
                <select name="status" defaultValue={screening.status} className="field">
                  {SCREENING_STATUS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Observações internas" hint="Só você vê. A cliente não tem acesso.">
                <textarea name="internal_notes" defaultValue={screening.internal_notes ?? ""} rows={5} className="field" />
              </Field>
            </AdminForm>
          </section>

          <section aria-labelledby="avaliacao">
            <h2 id="avaliacao" className="t-h3 mb-4">
              Avaliação
            </h2>
            {evaluations.length > 0 && (
              <ul className="mb-6 border-t border-linha">
                {evaluations.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-linha py-3">
                    <Link href={`/admin/agendamentos/${e.id}`} className="tnum link-draw">
                      {dateTimeLabel(e.starts_at)}
                    </Link>
                    <StatusBadge status={e.status} />
                  </li>
                ))}
              </ul>
            )}
            <AdminForm action={scheduleEvaluationAction} submitLabel="Agendar avaliação" resetOnSuccess className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={screening.id} />
              <Field label="Data">
                <input type="date" name="date" defaultValue={todayISO()} className="field" required />
              </Field>
              <Field label="Horário">
                <input type="time" name="time" step={300} className="field tnum" required />
              </Field>
              <Field label="Observação (opcional)" className="sm:col-span-2">
                <input name="notes" className="field" />
              </Field>
            </AdminForm>
            <p className="t-small mt-3">Ao agendar, o estado passa para “Avaliação agendada”; ao concluir a avaliação na agenda, para “Avaliada”.</p>
          </section>
        </div>
      </div>
    </>
  );
}
