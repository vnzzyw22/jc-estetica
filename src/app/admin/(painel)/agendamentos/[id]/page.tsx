import Link from "next/link";
import { notFound } from "next/navigation";
import { rescheduleAction, saveNotesAction } from "@/app/admin/(painel)/agendamentos/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { AppointmentActions } from "@/components/admin/appointment-actions";
import { Field, PageTitle, StatusBadge } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { dateISOFromEpoch, dayLabel, timeLabel } from "@/lib/date";
import { formatDuration, formatPrice } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata = { title: "Agendamento" };

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const appt = await db.get("appointments", id);
  if (!appt) notFound();

  const [client, service] = await Promise.all([db.get("clients", appt.client_id), appt.service_id ? db.get("services", appt.service_id) : Promise.resolve(null)]);
  const dateISO = dateISOFromEpoch(new Date(appt.starts_at).getTime());
  const time = timeLabel(appt.starts_at);
  const minutes = Math.round((new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60_000);
  const wa = client ? whatsappLink(client.phone, `Olá, ${client.name}! Sobre o seu horário de ${dayLabel(dateISO)} às ${time}: `) : null;

  return (
    <>
      <PageTitle title="Agendamento">
        <Link href="/admin/agendamentos" className="link-draw text-[0.9rem]">
          Voltar à lista
        </Link>
      </PageTitle>

      <div className="grid gap-x-12 gap-y-10 xl:grid-cols-2">
        <section aria-labelledby="dados">
          <h2 id="dados" className="sr-only">
            Dados
          </h2>
          <dl className="tnum border-t border-linha">
            {[
              ["Status", <StatusBadge key="s" status={appt.status} />],
              ["Data", dayLabel(dateISO)],
              ["Horário", `${time} (${formatDuration(minutes)})`],
              ["Procedimento", service?.name ?? (appt.kind === "evaluation" ? "Avaliação" : appt.kind === "return" ? "Retorno" : "Removido")],
              ["Valor", formatPrice(service?.price)],
              ["Origem", appt.source === "admin" ? "Criado no painel" : "Site"],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-baseline justify-between gap-6 border-b border-linha py-3">
                <dt className="t-small">{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <AppointmentActions id={appt.id} status={appt.status} redirectToList />
          </div>

          <h3 className="t-h3 mt-12 mb-4">Cliente</h3>
          {client ? (
            <dl className="border-t border-linha">
              <div className="flex justify-between gap-6 border-b border-linha py-3">
                <dt className="t-small">Nome</dt>
                <dd>
                  <Link href={`/admin/clientes/${client.id}`} className="link-draw">
                    {client.name}
                  </Link>
                </dd>
              </div>
              <div className="tnum flex justify-between gap-6 border-b border-linha py-3">
                <dt className="t-small">Telefone</dt>
                <dd>
                  {wa ? (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="link-draw">
                      {client.phone}
                    </a>
                  ) : (
                    client.phone
                  )}
                </dd>
              </div>
              {client.email && (
                <div className="flex justify-between gap-6 border-b border-linha py-3">
                  <dt className="t-small">E-mail</dt>
                  <dd>{client.email}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-cafe">Cliente removido.</p>
          )}
        </section>

        <div className="grid content-start gap-12">
          <section aria-labelledby="remarcar">
            <h2 id="remarcar" className="t-h3 mb-4">
              Remarcar
            </h2>
            <AdminForm action={rescheduleAction} submitLabel="Remarcar" className="grid max-w-md gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={appt.id} />
              <Field label="Nova data">
                <input type="date" name="date" defaultValue={dateISO} className="field" required />
              </Field>
              <Field label="Novo horário">
                <input type="time" name="time" defaultValue={time} step={300} className="field" required />
              </Field>
            </AdminForm>
          </section>

          <section aria-labelledby="obs">
            <h2 id="obs" className="t-h3 mb-4">
              Observações
            </h2>
            <AdminForm action={saveNotesAction} className="max-w-md">
              <input type="hidden" name="id" value={appt.id} />
              <textarea name="notes" defaultValue={appt.notes ?? ""} rows={4} className="field" aria-label="Observações do agendamento" />
            </AdminForm>
          </section>
        </div>
      </div>
    </>
  );
}
