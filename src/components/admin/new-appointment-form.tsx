import { createAppointmentAction } from "@/app/admin/(painel)/agendamentos/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { Field } from "@/components/admin/ui";
import { formatDuration } from "@/lib/format";
import type { Client, Service } from "@/lib/types";

interface Props {
  services: Service[];
  clients: Client[];
  defaultDate?: string;
  defaultClientId?: string;
}

/** Criação manual: cliente existente OU novo (nome + telefone). */
export function NewAppointmentForm({ services, clients, defaultDate, defaultClientId }: Props) {
  return (
    <AdminForm action={createAppointmentAction} submitLabel="Criar agendamento" resetOnSuccess className="grid gap-4 md:grid-cols-2">
      <Field label="Cliente existente" hint="Ou deixe em branco e preencha os dados de um cliente novo." className="md:col-span-2">
        <select name="client_id" className="field" defaultValue={defaultClientId ?? ""}>
          <option value="">— Novo cliente —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.phone}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nome (cliente novo)">
        <input name="name" className="field" autoComplete="off" />
      </Field>
      <Field label="Telefone com DDD (cliente novo)">
        <input name="phone" className="field" inputMode="tel" autoComplete="off" />
      </Field>
      <Field label="Procedimento" className="md:col-span-2">
        <select name="service_id" className="field" required>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({formatDuration(s.duration_minutes)})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Data">
        <input name="date" type="date" className="field" defaultValue={defaultDate} required />
      </Field>
      <Field label="Horário">
        <input name="time" type="time" className="field" step={300} required />
      </Field>
      <Field label="Status">
        <select name="status" className="field" defaultValue="confirmed">
          <option value="pending">Pendente</option>
          <option value="confirmed">Confirmado</option>
          <option value="completed">Concluído</option>
        </select>
      </Field>
      <Field label="Observações">
        <input name="notes" className="field" />
      </Field>
    </AdminForm>
  );
}
