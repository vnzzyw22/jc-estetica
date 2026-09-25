import Link from "next/link";
import { discardDraftAction, reopenAnamnesisAction, startAnamnesisAction } from "@/app/admin/(painel)/clientes/[id]/actions";
import { AnamnesisForm } from "@/components/admin/anamnesis-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ScreeningData } from "@/components/admin/screening-data";
import { Empty } from "@/components/admin/ui";
import { ANAMNESIS_FIELDS } from "@/lib/anamnesis";
import type { ClientFile } from "@/lib/client-file";
import { dateTimeLabel } from "@/lib/date";
import { labels } from "@/lib/screening";

interface Props {
  file: ClientFile;
  selectedId?: string;
  today: string;
}

export function AnamnesisTab({ file, selectedId, today }: Props) {
  const { client, anamneses, screenings } = file;
  const selected = (selectedId ? anamneses.find((a) => a.id === selectedId) : undefined) ?? anamneses.find((a) => a.status === "draft") ?? anamneses[0];
  const baseScreening = (selected?.screening_id ? screenings.find((s) => s.id === selected.screening_id) : undefined) ?? screenings[0];
  const hasDraft = anamneses.some((a) => a.status === "draft");

  const start = (
    <form action={startAnamnesisAction} className="grid max-w-md gap-4">
      <input type="hidden" name="client_id" value={client.id} />
      {screenings.length > 0 && (
        <label className="block">
          <span className="mb-1.5 block text-[0.9rem] font-medium">Triagem que serve de base</span>
          <select name="screening_id" defaultValue={baseScreening?.id ?? ""} className="field">
            {screenings.map((s) => (
              <option key={s.id} value={s.id}>
                {dateTimeLabel(s.created_at)}, {labels.goal(s.goal) ?? "sem objetivo"}
              </option>
            ))}
          </select>
        </label>
      )}
      <div>
        <button type="submit" className="btn btn-sm">
          {anamneses.length ? "Nova anamnese (reavaliação)" : "Iniciar anamnese"}
        </button>
      </div>
    </form>
  );

  return (
    <div className="grid gap-x-12 gap-y-12 xl:grid-cols-2">
      <section aria-labelledby="pre">
        <h2 id="pre" className="t-h3 mb-1">
          Informado pela cliente
        </h2>
        <p className="t-small mb-4">Pré-anamnese: o que ela respondeu na triagem. Somente leitura.</p>
        {baseScreening ? <ScreeningData screening={baseScreening} compact /> : <Empty>Esta cliente não enviou triagem. A anamnese pode ser feita mesmo assim.</Empty>}
      </section>

      <section aria-labelledby="prof">
        <h2 id="prof" className="t-h3 mb-1">
          Anamnese profissional
        </h2>
        {selected ? (
          <>
            <p className="t-small mb-4">
              {selected.status === "draft" ? "Rascunho" : "Concluída"}
              {selected.status === "completed" && selected.completed_at ? ` em ${dateTimeLabel(selected.completed_at)}` : ""}
            </p>

            {selected.status === "draft" ? (
              <>
                <AnamnesisForm key={selected.id} anamnesis={selected} today={today} />
                <form action={discardDraftAction} className="mt-6">
                  <input type="hidden" name="client_id" value={client.id} />
                  <input type="hidden" name="id" value={selected.id} />
                  <ConfirmButton confirm="Descartar este rascunho? O que foi escrito nele será apagado." className="link-draw text-[0.9rem] text-alerta">
                    Descartar rascunho
                  </ConfirmButton>
                </form>
              </>
            ) : (
              <>
                <dl className="border-t border-linha">
                  <div className="grid gap-1 border-b border-linha py-3 sm:grid-cols-[11rem_1fr] sm:gap-6">
                    <dt className="t-small">Data da avaliação</dt>
                    <dd className="tnum">{selected.assessed_at ? selected.assessed_at.slice(0, 10).split("-").reverse().join("/") : "—"}</dd>
                  </div>
                  {ANAMNESIS_FIELDS.map((f) =>
                    selected[f.key] ? (
                      <div key={f.key} className="grid gap-1 border-b border-linha py-3 sm:grid-cols-[11rem_1fr] sm:gap-6">
                        <dt className="t-small">{f.label}</dt>
                        <dd className="min-w-0 whitespace-pre-line break-words">{selected[f.key]}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <form action={reopenAnamnesisAction}>
                    <input type="hidden" name="client_id" value={client.id} />
                    <input type="hidden" name="id" value={selected.id} />
                    <ConfirmButton confirm="Reabrir esta anamnese para edição? Ela volta a ser rascunho." className="link-draw font-medium">
                      Reabrir para editar
                    </ConfirmButton>
                  </form>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p className="t-small mb-4">Ainda não há anamnese para esta cliente.</p>
            {start}
          </>
        )}

        {selected?.status === "completed" && !hasDraft && (
          <div className="mt-10 border-t border-linha pt-6">
            <h3 className="t-h3 mb-3">Reavaliação</h3>
            <p className="t-small mb-4 max-w-[52ch]">Abre uma nova anamnese, e a atual continua guardada no histórico.</p>
            {start}
          </div>
        )}

        {anamneses.length > 1 && (
          <div className="mt-10">
            <h3 className="t-h3 mb-3">Histórico de anamneses</h3>
            <ul className="border-t border-linha">
              {anamneses.map((a) => (
                <li key={a.id} className="border-b border-linha">
                  <Link href={`/admin/clientes/${client.id}?aba=anamnese&id=${a.id}`} aria-current={a.id === selected?.id ? "true" : undefined} className={`flex items-baseline justify-between gap-4 py-3 transition-colors hover:text-bisturi ${a.id === selected?.id ? "font-medium" : ""}`}>
                    <span className="tnum">{dateTimeLabel(a.created_at)}</span>
                    <span className="t-small">{a.status === "draft" ? "Rascunho" : "Concluída"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
