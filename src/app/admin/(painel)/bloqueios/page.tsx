import { createBlockAction, deleteBlockAction } from "@/app/admin/(painel)/bloqueios/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Empty, Field, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { dateTimeLabel, isValidDateISO, nowISO, todayISO } from "@/lib/date";
import { BLOCK_KIND_LABEL } from "@/lib/format";

export const metadata = { title: "Bloqueios" };

export default async function BlocksPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const { db } = await requireAdmin();
  const { data } = await searchParams;
  const startDate = data && isValidDateISO(data) ? data : todayISO();

  const now = nowISO();
  const blocks = (await db.list("blocked_slots", { order: [["starts_at", "asc"]] })).filter((b) => b.ends_at >= now);

  return (
    <>
      <PageTitle title="Bloqueios" />

      <div className="grid gap-x-12 gap-y-12 xl:grid-cols-2">
        <section aria-labelledby="novo-bloqueio">
          <h2 id="novo-bloqueio" className="t-h3 mb-4">
            Novo bloqueio
          </h2>
          <AdminForm action={createBlockAction} submitLabel="Bloquear" resetOnSuccess className="grid max-w-lg gap-4 sm:grid-cols-2">
            <Field label="Tipo">
              <select name="kind" className="field" defaultValue="block">
                {Object.entries(BLOCK_KIND_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Abrangência">
              <select name="scope" className="field" defaultValue="days">
                <option value="days">Dia(s) inteiro(s)</option>
                <option value="time">Horário específico</option>
              </select>
            </Field>
            <Field label="Data inicial">
              <input type="date" name="start_date" defaultValue={startDate} className="field" required />
            </Field>
            <Field label="Data final" hint="Vazio = mesmo dia.">
              <input type="date" name="end_date" className="field" />
            </Field>
            <Field label="Das (horário específico)">
              <input type="time" name="start_time" className="field tnum" />
            </Field>
            <Field label="Até (horário específico)">
              <input type="time" name="end_time" className="field tnum" />
            </Field>
            <Field label="Motivo (só você vê)" className="sm:col-span-2">
              <input name="reason" className="field" />
            </Field>
          </AdminForm>
        </section>

        <section aria-labelledby="bloqueios-ativos">
          <h2 id="bloqueios-ativos" className="t-h3 mb-4">
            Bloqueios ativos e futuros
          </h2>
          {blocks.length === 0 ? (
            <Empty>Nenhum bloqueio.</Empty>
          ) : (
            <ul className="border-t border-linha">
              {blocks.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-linha py-3.5">
                  <div>
                    <p className="font-medium">{BLOCK_KIND_LABEL[b.kind]}</p>
                    <p className="tnum t-small">
                      {dateTimeLabel(b.starts_at)} até {dateTimeLabel(b.ends_at)}
                    </p>
                    {b.reason && <p className="t-small">{b.reason}</p>}
                  </div>
                  <form action={deleteBlockAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <ConfirmButton confirm="Remover este bloqueio? Os horários voltam a ficar livres." className="link-draw text-[0.9rem] text-alerta">
                      Remover
                    </ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
