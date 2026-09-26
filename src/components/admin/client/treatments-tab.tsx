import Link from "next/link";
import { createTreatmentAction } from "@/app/admin/(painel)/tratamentos/actions";
import { ProgressLine, TreatmentChip } from "@/components/admin/treatment/chips";
import { Empty, Field } from "@/components/admin/ui";
import type { ClientFile } from "@/lib/client-file";
import { dateBR, dateISOFromEpoch, dateTimeLabel } from "@/lib/date";
import { formatMoney } from "@/lib/format";
import { BILLING_LABEL, sessionProgress } from "@/lib/treatment";
import { labels } from "@/lib/screening";
import type { TreatmentPackage } from "@/lib/types";

interface Props {
  file: ClientFile;
  packages: TreatmentPackage[];
}

/** Tratamentos da cliente: o que está em andamento e como propor um novo (de um pacote ou personalizado). */
export function TreatmentsTab({ file, packages }: Props) {
  const { client, treatments, sessions, screenings } = file;
  const back = `/admin/clientes/${client.id}?aba=tratamentos`;
  const sessionsOf = (id: string) => sessions.filter((s) => s.treatment_id === id);
  const usable = packages.filter((p) => p.active);
  const latestScreening = screenings[0]?.id ?? "";

  const screeningSelect = screenings.length > 0 && (
    <Field label="Triagem de origem" hint="Liga o tratamento ao lead: o estado da triagem acompanha.">
      <select name="screening_id" defaultValue={latestScreening} className="field">
        <option value="">Nenhuma</option>
        {screenings.map((s) => (
          <option key={s.id} value={s.id}>
            {dateTimeLabel(s.created_at)}, {labels.goal(s.goal) ?? "sem objetivo"}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <div className="grid gap-x-12 gap-y-14 xl:grid-cols-2">
      <section aria-labelledby="trat-lista">
        <h2 id="trat-lista" className="t-h3 mb-4">
          Tratamentos
        </h2>
        {treatments.length === 0 ? (
          <Empty>Nenhum tratamento para esta cliente. Proponha o primeiro ao lado.</Empty>
        ) : (
          <ul className="border-t border-linha">
            {treatments.map((t) => {
              const progress = sessionProgress(sessionsOf(t.id));
              return (
                <li key={t.id} className="border-b border-linha">
                  <Link href={`/admin/tratamentos/${t.id}`} className="grid gap-x-4 gap-y-2 px-1 py-4 transition-colors hover:bg-seda/60 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <span className="min-w-0">
                      <span className="block font-medium">{t.name}</span>
                      <span className="t-small block">
                        {BILLING_LABEL[t.billing_mode]}
                        {t.billing_mode === "package" && t.price_total !== null ? `, ${formatMoney(t.price_total)}` : ""}
                        {t.started_at ? `, iniciado em ${dateBR(dateISOFromEpoch(Date.parse(t.started_at)))}` : ", proposto"}
                      </span>
                    </span>
                    <span className="sm:text-right">
                      <TreatmentChip status={t.status} />
                    </span>
                    {progress.total > 0 && (
                      <span className="max-w-xs sm:col-span-2">
                        <ProgressLine progress={progress} compact />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid content-start gap-12">
        <section aria-labelledby="trat-pacote">
          <h2 id="trat-pacote" className="t-h3 mb-2">
            Propor um pacote
          </h2>
          {usable.length === 0 ? (
            <p className="text-cafe">
              Nenhum pacote ativo no catálogo. <Link href="/admin/pacotes?edit=novo" className="link-draw text-espresso">Criar um pacote</Link> ou propor um tratamento personalizado abaixo.
            </p>
          ) : (
            <form action={createTreatmentAction} className="grid max-w-lg gap-4">
              <input type="hidden" name="client_id" value={client.id} />
              <input type="hidden" name="back" value={back} />
              <Field label="Pacote">
                <select name="package_id" required defaultValue="" className="field">
                  <option value="" disabled>
                    Escolha…
                  </option>
                  {usable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}, {p.session_count} {p.session_count === 1 ? "sessão" : "sessões"}
                      {p.price !== null ? `, ${formatMoney(p.price)}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {screeningSelect}
              <div>
                <button type="submit" className="btn btn-sm">
                  Propor tratamento
                </button>
              </div>
              <p className="t-small max-w-[52ch]">Cria uma proposta com os dados do pacote. As sessões só são geradas quando você inicia o tratamento.</p>
            </form>
          )}
        </section>

        <details className="max-w-lg border border-linha px-5 py-4">
          <summary className="cursor-pointer font-medium">Tratamento personalizado (sem pacote)</summary>
          <form action={createTreatmentAction} className="mt-5 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="client_id" value={client.id} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="package_id" value="personalizado" />
            <Field label="Nome" className="sm:col-span-2">
              <input name="name" maxLength={120} required className="field" />
            </Field>
            <Field label="Objetivo" className="sm:col-span-2">
              <input name="goal" maxLength={300} className="field" />
            </Field>
            <Field label="Sessões">
              <input name="total_sessions" type="number" min={1} max={200} defaultValue={1} required className="field tnum" />
            </Field>
            <Field label="Cobrança">
              <select name="billing_mode" defaultValue="package" className="field">
                <option value="package">Pacote fechado</option>
                <option value="per_session">Por sessão</option>
              </select>
            </Field>
            <Field label="Valor do pacote (R$)">
              <input name="price_total" inputMode="decimal" className="field tnum" />
            </Field>
            <Field label="Valor por sessão (R$)" hint="Obrigatório na cobrança por sessão.">
              <input name="session_price" inputMode="decimal" className="field tnum" />
            </Field>
            <Field label="Intervalo (dias)">
              <input name="interval_days" type="number" min={1} max={365} className="field tnum" />
            </Field>
            <Field label="Frequência (texto livre)">
              <input name="frequency_note" maxLength={200} className="field" />
            </Field>
            <div className="sm:col-span-2">{screeningSelect}</div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-sm">
                Propor tratamento
              </button>
            </div>
          </form>
        </details>
      </div>
    </div>
  );
}
