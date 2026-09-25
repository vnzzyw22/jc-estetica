import { AppointmentLine } from "@/components/admin/appointment-line";
import { NewAppointmentForm } from "@/components/admin/new-appointment-form";
import { Empty } from "@/components/admin/ui";
import type { ClientFile } from "@/lib/client-file";
import { todayISO } from "@/lib/date";
import type { Service } from "@/lib/types";

/** Agenda da cliente: o que vem aí e o histórico. Criar agendamento já com ela selecionada. */
export function AgendaTab({ file, services, nowMs }: { file: ClientFile; services: Service[]; nowMs: number }) {
  const upcoming = file.appointments.filter((a) => a.status !== "cancelled" && new Date(a.starts_at).getTime() >= nowMs).sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
  const past = file.appointments.filter((a) => !upcoming.includes(a));

  return (
    <div className="grid gap-x-12 gap-y-12 xl:grid-cols-2">
      <div className="grid content-start gap-12">
        <section aria-labelledby="proximos">
          <h2 id="proximos" className="t-h3 mb-4">
            Próximos
          </h2>
          {upcoming.length ? (
            <ul className="border-t border-linha">
              {upcoming.map((a) => (
                <AppointmentLine key={a.id} a={a} showDate />
              ))}
            </ul>
          ) : (
            <Empty>Nada agendado.</Empty>
          )}
        </section>

        <section aria-labelledby="novo">
          <h2 id="novo" className="t-h3 mb-4">
            Novo agendamento
          </h2>
          {services.length ? (
            <NewAppointmentForm services={services} clients={[file.client]} defaultClientId={file.client.id} defaultDate={todayISO()} />
          ) : (
            <p className="text-cafe">Cadastre um serviço ativo antes.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="historico">
        <h2 id="historico" className="t-h3 mb-4">
          Histórico
        </h2>
        {past.length ? (
          <ul className="border-t border-linha">
            {past.map((a) => (
              <AppointmentLine key={a.id} a={a} showDate />
            ))}
          </ul>
        ) : (
          <Empty>Sem atendimentos anteriores.</Empty>
        )}
      </section>
    </div>
  );
}
