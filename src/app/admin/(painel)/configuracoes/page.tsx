import { saveSettingsAction } from "@/app/admin/(painel)/configuracoes/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { Field, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const { db } = await requireAdmin();
  const [s] = await db.list("settings", { limit: 1 });

  return (
    <>
      <PageTitle title="Configurações" />
      <AdminForm action={saveSettingsAction} submitLabel="Salvar configurações" className="max-w-3xl">
        <fieldset className="mb-12 grid gap-5 sm:grid-cols-2">
          <legend className="t-h3 mb-4">Marca e contatos</legend>
          <Field label="Nome">
            <input name="business_name" defaultValue={s.business_name} className="field" required />
          </Field>
          <Field label="Descrição curta" hint="Aparece no topo do site e no rodapé.">
            <input name="business_tagline" defaultValue={s.business_tagline} className="field" />
          </Field>
          <Field label="WhatsApp" hint="DDD + número. Alimenta todos os links de conversa do site.">
            <input name="whatsapp" defaultValue={s.whatsapp ?? ""} inputMode="tel" className="field" />
          </Field>
          <Field label="Instagram" hint="@usuario ou o link do perfil.">
            <input name="instagram" defaultValue={s.instagram ?? ""} className="field" />
          </Field>
          <Field label="E-mail">
            <input name="email" type="email" defaultValue={s.email ?? ""} className="field" />
          </Field>
          <Field label="Cidade / localidade">
            <input name="city" defaultValue={s.city ?? ""} className="field" />
          </Field>
          <Field label="Endereço" className="sm:col-span-2">
            <input name="address" defaultValue={s.address ?? ""} className="field" />
          </Field>
        </fieldset>

        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="t-h3 mb-4">Agendamento</legend>
          <Field label="Intervalo entre horários (min)" hint="De quanto em quanto tempo o site oferece um novo horário.">
            <input name="slot_interval_minutes" type="number" min={5} max={240} step={5} defaultValue={s.slot_interval_minutes} className="field" />
          </Field>
          <Field label="Antecedência mínima (horas)" hint="Não aceita agendamento em cima da hora.">
            <input name="min_notice_hours" type="number" min={0} defaultValue={s.min_notice_hours} className="field" />
          </Field>
          <Field label="Agenda aberta até (dias)" hint="Quantos dias à frente o cliente consegue agendar.">
            <input name="max_days_ahead" type="number" min={1} max={365} defaultValue={s.max_days_ahead} className="field" />
          </Field>
          <Field label="Folga entre atendimentos (min)">
            <input name="buffer_minutes" type="number" min={0} step={5} defaultValue={s.buffer_minutes} className="field" />
          </Field>
          <Field label="Duração da avaliação (min)" hint="Vale para avaliações e retornos marcados sem um serviço.">
            <input name="evaluation_duration_minutes" type="number" min={5} max={480} step={5} defaultValue={s.evaluation_duration_minutes} className="field" />
          </Field>
          <label className="flex items-start gap-3 sm:col-span-2">
            <input type="checkbox" name="auto_confirm" defaultChecked={s.auto_confirm} className="mt-1 h-5 w-5 accent-[var(--color-bisturi)]" />
            <span>
              Confirmar agendamentos automaticamente
              <span className="t-small block">Desmarcado, cada pedido chega como “Pendente” até você confirmar.</span>
            </span>
          </label>
        </fieldset>
      </AdminForm>
    </>
  );
}
