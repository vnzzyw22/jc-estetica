import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteClientAction, saveClientAction } from "@/app/admin/(painel)/clientes/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { AppointmentLine } from "@/components/admin/appointment-line";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Empty, Field, PageTitle } from "@/components/admin/ui";
import { listAppointmentDetails } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata = { title: "Cliente" };

export default async function ClientDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const client = await db.get("clients", id);
  if (!client) notFound();

  const history = (await listAppointmentDetails(db)).filter((a) => a.client_id === id).reverse();
  const wa = whatsappLink(client.phone);
  const hasHistoryError = (await searchParams).erro === "historico";

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
        <Link href={`/admin/agendamentos?novo=1`} className="btn btn-sm">
          Novo agendamento
        </Link>
      </PageTitle>

      {hasHistoryError && (
        <p role="alert" className="mb-6 border-l-2 border-alerta bg-alerta/5 px-4 py-3 text-alerta">
          Este cliente tem agendamentos e não pode ser excluído. Exclua ou mantenha o histórico.
        </p>
      )}

      <div className="grid gap-x-12 gap-y-12 xl:grid-cols-2">
        <section aria-labelledby="dados">
          <h2 id="dados" className="t-h3 mb-4">
            Dados
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
            <ConfirmButton confirm="Excluir este cliente? Só é possível se ele não tiver agendamentos." className="link-draw text-[0.9rem] text-alerta">
              Excluir cliente
            </ConfirmButton>
          </form>
        </section>

        <section aria-labelledby="historico">
          <h2 id="historico" className="t-h3 mb-4">
            Histórico
          </h2>
          {history.length ? (
            <ul className="border-t border-linha">
              {history.map((a) => (
                <AppointmentLine key={a.id} a={a} showDate />
              ))}
            </ul>
          ) : (
            <Empty>Sem agendamentos.</Empty>
          )}
        </section>
      </div>
    </>
  );
}
