import { createReceivableAction } from "@/app/admin/(painel)/financeiro/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { MethodOptions } from "@/components/admin/finance/receive-form";
import { Field } from "@/components/admin/ui";
import { todayISO } from "@/lib/date";
import type { Client, Treatment } from "@/lib/types";

export interface ReceivablePrefill {
  clientId?: string;
  treatmentId?: string;
  /** Liga o recebimento a um atendimento; o tipo passa a ser "Atendimento". */
  appointmentId?: string;
  /** Texto que explica o vínculo (ex.: "Limpeza de Pele, 24/09"), só para a pessoa conferir. */
  appointmentLabel?: string;
  description?: string;
  amount?: string;
}

interface ReceivableFormProps {
  clients: Client[];
  treatments: Treatment[];
  prefill?: ReceivablePrefill;
  /** Na ficha da cliente ela já é conhecida: o campo some e vai escondido. */
  lockedClient?: Client;
}

/** Novo recebimento: à vista ou parcelado, avulso ou ligado a cliente, tratamento e atendimento. */
export function ReceivableForm({ clients, treatments, prefill = {}, lockedClient }: ReceivableFormProps) {
  const today = todayISO();
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const options = lockedClient ? treatments.filter((t) => t.client_id === lockedClient.id) : treatments;

  return (
    <AdminForm action={createReceivableAction} submitLabel="Registrar recebimento" resetOnSuccess className="grid max-w-3xl gap-x-5 gap-y-4 sm:grid-cols-2">
      {lockedClient ? (
        <input type="hidden" name="client_id" value={lockedClient.id} />
      ) : (
        <Field label="Cliente" hint="Vazio para uma venda avulsa, sem cliente." className="sm:col-span-2">
          <select name="client_id" defaultValue={prefill.clientId ?? ""} className="field">
            <option value="">Sem cliente (avulso)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {prefill.appointmentId && (
        <>
          <input type="hidden" name="appointment_id" value={prefill.appointmentId} />
          <p className="t-small sm:col-span-2">Vinculado ao atendimento{prefill.appointmentLabel ? `: ${prefill.appointmentLabel}` : ""}.</p>
        </>
      )}

      <Field label="Descrição" hint="O que está sendo cobrado. Com tratamento ou atendimento, pode ficar vazio." className="sm:col-span-2">
        <input name="description" defaultValue={prefill.description} maxLength={200} className="field" />
      </Field>

      <Field label="Valor total (R$)">
        <input name="amount" inputMode="decimal" defaultValue={prefill.amount} placeholder="150,00" required className="field tnum" />
      </Field>
      <Field label="Forma de pagamento" hint="Obrigatória para marcar como já recebido.">
        <select name="method" defaultValue="" className="field">
          <MethodOptions optional />
        </select>
      </Field>

      <Field label="Parcelas" hint="1 a 36. A última parcela absorve os centavos.">
        <input name="installments" type="number" min={1} max={36} defaultValue={1} className="field tnum" />
      </Field>
      <Field label="Primeiro vencimento">
        <input name="first_due" type="date" defaultValue={today} className="field tnum" />
      </Field>

      {options.length > 0 && !prefill.appointmentId && (
        <Field label="Tratamento (opcional)" className="sm:col-span-2">
          <select name="treatment_id" defaultValue={prefill.treatmentId ?? ""} className="field">
            <option value="">Nenhum</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {lockedClient ? t.name : `${clientName.get(t.client_id) ?? "Cliente"}: ${t.name}`}
              </option>
            ))}
          </select>
        </Field>
      )}

      <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
        <legend className="sr-only">Já recebido</legend>
        <label className="flex items-start gap-3 sm:col-span-2">
          <input type="checkbox" name="already_paid" className="mt-1 h-5 w-5 accent-[var(--color-bisturi)]" />
          <span>
            Já foi recebido
            <span className="t-small block">Só para pagamento em parcela única. Entra no caixa como recebido, na data abaixo.</span>
          </span>
        </label>
        <Field label="Data do recebimento">
          <input name="paid_date" type="date" defaultValue={today} max={today} className="field tnum" />
        </Field>
      </fieldset>
    </AdminForm>
  );
}
