import Link from "next/link";
import { notFound } from "next/navigation";
import { createPlanAction } from "@/app/admin/(painel)/financeiro/actions";
import {
  addEvolutionAction,
  cancelTreatmentAction,
  deleteEvolutionAction,
  deleteTreatmentAction,
  pauseTreatmentAction,
  startTreatmentAction,
  updateTreatmentAction,
} from "@/app/admin/(painel)/tratamentos/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PaymentChip } from "@/components/admin/finance/finance-chip";
import { Notice } from "@/components/admin/finance/notice";
import { MethodOptions } from "@/components/admin/finance/receive-form";
import { ProgressLine, TreatmentChip } from "@/components/admin/treatment/chips";
import { SessionRow } from "@/components/admin/treatment/session-row";
import { Empty, Field } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { dateBR, dateISOFromEpoch, dateTimeLabel, todayISO } from "@/lib/date";
import { paymentView, queryString } from "@/lib/finance";
import { BILLING_LABEL, treatmentActions } from "@/lib/treatment";
import { loadTreatmentDetail } from "@/lib/treatment-data";
import { formatMoney } from "@/lib/format";

export const metadata = { title: "Tratamento" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ agendar?: string; concluir?: string; erro?: string; aviso?: string }> };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-linha py-3">
      <dt className="t-small">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function ActionForm({ action, id, label, confirm, danger }: { action: (fd: FormData) => Promise<void>; id: string; label: string; confirm?: string; danger?: boolean }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton confirm={confirm} className={`link-draw text-[0.9rem] ${danger ? "text-alerta" : ""}`}>
        {label}
      </ConfirmButton>
    </form>
  );
}

export default async function TreatmentPage({ params, searchParams }: Props) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const detail = await loadTreatmentDetail(db, id);
  if (!detail) notFound();

  const { treatment: t, client, pkg, sessions, evolutions, payments, services, progress } = detail;
  const today = todayISO();
  const can = treatmentActions(t.status);
  const url = (extra: Record<string, string | undefined> = {}) => `/admin/tratamentos/${t.id}${queryString(extra)}`;
  const activeServices = services.filter((s) => s.active);
  const numberOf = new Map(sessions.map((s) => [s.id, s.number]));
  const livePayments = payments.filter((p) => p.status === "pending" || p.status === "paid");
  const canPlan = t.billing_mode === "package" && t.price_total !== null && t.price_total > 0 && livePayments.every((p) => p.kind !== "treatment") && t.status !== "cancelled";
  const editable = can.edit;

  return (
    <>
      <Notice erro={sp.erro} aviso={sp.aviso} />
      <p className="mb-6">
        <Link href="/admin/tratamentos" className="link-draw text-[0.9rem]">
          Voltar aos tratamentos
        </Link>
      </p>

      <div className="grid gap-x-12 gap-y-14 xl:grid-cols-2">
        <div className="grid content-start gap-10">
          <section aria-labelledby="dados" className="grid gap-6">
            <div>
              <h1 id="dados" className="t-h2">
                {t.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <TreatmentChip status={t.status} />
                {client && (
                  <Link href={`/admin/clientes/${client.id}?aba=tratamentos`} className="link-draw">
                    {client.name}
                  </Link>
                )}
              </div>
            </div>

            {progress.total > 0 && (
              <div className="max-w-md">
                <ProgressLine progress={progress} />
              </div>
            )}

            <dl className="tnum border-t border-linha">
              {t.goal && <Fact label="Objetivo">{t.goal}</Fact>}
              <Fact label="Cobrança">
                {BILLING_LABEL[t.billing_mode]}
                {t.billing_mode === "package" && t.price_total !== null && <span className="block">{formatMoney(t.price_total)}</span>}
                {t.billing_mode === "per_session" && t.session_price !== null && <span className="block">{formatMoney(t.session_price)} por sessão</span>}
              </Fact>
              <Fact label="Sessões previstas">{t.total_sessions}</Fact>
              {(t.interval_days || t.frequency_note) && (
                <Fact label="Ritmo">
                  {t.interval_days ? `a cada ${t.interval_days} dias` : ""}
                  {t.interval_days && t.frequency_note ? ", " : ""}
                  {t.frequency_note}
                </Fact>
              )}
              {t.valid_until && <Fact label="Válido até">{dateBR(t.valid_until)}</Fact>}
              <Fact label="Proposto em">{dateBR(dateISOFromEpoch(Date.parse(t.proposed_at)))}</Fact>
              {t.started_at && <Fact label="Iniciado em">{dateBR(dateISOFromEpoch(Date.parse(t.started_at)))}</Fact>}
              {t.completed_at && <Fact label="Concluído em">{dateBR(dateISOFromEpoch(Date.parse(t.completed_at)))}</Fact>}
              {pkg && <Fact label="Pacote de origem">{pkg.name}</Fact>}
            </dl>
            {t.notes && <p className="max-w-[60ch] whitespace-pre-line border-l-2 border-rose pl-4 text-[0.95rem]">{t.notes}</p>}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {can.start && (
                <form action={startTreatmentAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="btn btn-sm">
                    Iniciar tratamento
                  </button>
                </form>
              )}
              {can.resume && (
                <form action={startTreatmentAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="btn btn-sm">
                    Retomar tratamento
                  </button>
                </form>
              )}
              {can.pause && <ActionForm action={pauseTreatmentAction} id={t.id} label="Pausar" confirm="Pausar o tratamento? Os horários já marcados continuam na agenda." />}
              {can.cancel && (
                <ActionForm
                  action={cancelTreatmentAction}
                  id={t.id}
                  label="Cancelar tratamento"
                  danger
                  confirm="Cancelar o tratamento? As sessões em aberto são canceladas e os horários delas na agenda voltam a ficar livres. As sessões já realizadas e as cobranças não mudam."
                />
              )}
              {can.remove && (
                <form action={deleteTreatmentAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="back" value={client ? `/admin/clientes/${client.id}?aba=tratamentos` : "/admin/tratamentos"} />
                  <ConfirmButton confirm="Excluir esta proposta? Só é possível se ainda não houver cobranças." className="link-draw text-[0.9rem] text-alerta">
                    Excluir proposta
                  </ConfirmButton>
                </form>
              )}
            </div>
            {t.status === "proposed" && <p className="t-small max-w-[58ch]">É uma proposta: as sessões são geradas quando você inicia o tratamento. Ajuste os dados ao lado antes, se precisar.</p>}
          </section>

          <section aria-labelledby="sessoes">
            <h2 id="sessoes" className="t-h3 mb-4">
              Sessões
            </h2>
            {sessions.length === 0 ? (
              <Empty>{t.status === "proposed" ? "As sessões aparecem aqui quando o tratamento for iniciado." : "Nenhuma sessão."}</Empty>
            ) : (
              <ul className="border-t border-linha">
                {sessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    s={s}
                    treatmentId={t.id}
                    treatmentStatus={t.status}
                    services={activeServices}
                    today={today}
                    scheduling={sp.agendar === s.id}
                    completing={sp.concluir === s.id}
                    scheduleHref={url({ agendar: s.id })}
                    completeHref={url({ concluir: s.id })}
                    closeHref={url()}
                  />
                ))}
              </ul>
            )}
            {t.status === "paused" && sessions.length > 0 && <p className="t-small mt-4">Tratamento pausado: retome para agendar ou realizar sessões.</p>}
          </section>
        </div>

        <div className="grid content-start gap-14">
          <section aria-labelledby="evolucao">
            <h2 id="evolucao" className="t-h3 mb-2">
              Evolução
            </h2>
            <p className="t-small mb-4 max-w-[58ch]">Registro de acompanhamento do tratamento. Não é diagnóstico médico.</p>
            {t.status !== "cancelled" && (
              <AdminForm action={addEvolutionAction} submitLabel="Registrar evolução" resetOnSuccess className="mb-8 grid max-w-xl gap-4">
                <input type="hidden" name="treatment_id" value={t.id} />
                <Field label="O que observar ou registrar">
                  <textarea name="notes" rows={3} maxLength={4000} required className="field" />
                </Field>
                {sessions.length > 0 && (
                  <Field label="Sessão (opcional)">
                    <select name="session_id" defaultValue="" className="field">
                      <option value="">Do tratamento, sem sessão específica</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          Sessão {s.number}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </AdminForm>
            )}
            {evolutions.length === 0 ? (
              <Empty>Nenhum registro ainda.</Empty>
            ) : (
              <ul className="border-t border-linha">
                {evolutions.map((e) => (
                  <li key={e.id} className="border-b border-linha py-4">
                    <p className="tnum t-small">
                      {dateTimeLabel(e.recorded_at)}
                      {e.session_id && numberOf.has(e.session_id) ? `, sessão ${numberOf.get(e.session_id)}` : ""}
                    </p>
                    <p className="mt-1 max-w-[62ch] whitespace-pre-line">{e.notes}</p>
                    <form action={deleteEvolutionAction} className="mt-1">
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="treatment_id" value={t.id} />
                      <ConfirmButton confirm="Remover este registro de evolução?" className="link-draw text-[0.85rem] text-alerta">
                        Remover
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="financeiro">
            <h2 id="financeiro" className="t-h3 mb-4">
              Financeiro
            </h2>
            {t.billing_mode === "per_session" && <p className="t-small mb-4 max-w-[58ch]">Cobrança por sessão: cada sessão realizada gera uma cobrança de {t.session_price !== null ? formatMoney(t.session_price) : "valor a definir"}, a receber.</p>}
            {payments.length > 0 && (
              <ul className="tnum mb-6 border-t border-linha">
                {payments.map((p) => (
                  <li key={p.id} className="border-b border-linha">
                    <Link href={`/admin/financeiro/recebimentos/${p.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-4 py-3 transition-colors hover:bg-seda/60">
                      <span className="truncate">
                        {p.description ?? "Cobrança"}
                        {p.installment_total > 1 && <span className="t-small ml-2">{p.installment_number}/{p.installment_total}</span>}
                      </span>
                      <span>{formatMoney(p.amount)}</span>
                      <PaymentChip view={paymentView(p, today)} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {canPlan && (
              <AdminForm action={createPlanAction} submitLabel="Gerar parcelas" className="mb-6 grid max-w-lg gap-4 sm:grid-cols-2">
                <input type="hidden" name="treatment_id" value={t.id} />
                <p className="t-small sm:col-span-2">Divide {formatMoney(t.price_total ?? 0)} em parcelas mensais.</p>
                <Field label="Parcelas">
                  <input name="installments" type="number" min={1} max={36} defaultValue={1} className="field tnum" />
                </Field>
                <Field label="1º vencimento">
                  <input name="first_due" type="date" defaultValue={today} className="field tnum" />
                </Field>
                <Field label="Forma de pagamento" className="sm:col-span-2">
                  <select name="method" defaultValue="" className="field">
                    <MethodOptions optional />
                  </select>
                </Field>
              </AdminForm>
            )}
            <Link href={`/admin/financeiro/recebimentos${queryString({ tratamento: t.id })}`} className="link-draw text-[0.9rem] font-medium">
              Registrar outro recebimento deste tratamento
            </Link>
          </section>

          {editable && (
            <section aria-labelledby="editar">
              <h2 id="editar" className="t-h3 mb-4">
                Editar
              </h2>
              <AdminForm action={updateTreatmentAction} submitLabel="Salvar alterações" className="grid max-w-xl gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={t.id} />
                <Field label="Nome" className="sm:col-span-2">
                  <input name="name" defaultValue={t.name} maxLength={120} required className="field" />
                </Field>
                <Field label="Objetivo" className="sm:col-span-2">
                  <input name="goal" defaultValue={t.goal ?? ""} maxLength={300} className="field" />
                </Field>
                <Field label="Sessões" hint={t.status === "proposed" ? undefined : "Só muda enquanto é proposta."}>
                  <input name="total_sessions" type="number" min={1} max={200} defaultValue={t.total_sessions} disabled={t.status !== "proposed"} className="field tnum" />
                </Field>
                <Field label="Cobrança" hint={t.status === "proposed" ? undefined : "Só muda enquanto é proposta."}>
                  <select name="billing_mode" defaultValue={t.billing_mode} disabled={t.status !== "proposed"} className="field">
                    <option value="package">Pacote fechado</option>
                    <option value="per_session">Por sessão</option>
                  </select>
                </Field>
                <Field label="Valor do pacote (R$)">
                  <input name="price_total" inputMode="decimal" defaultValue={t.price_total !== null ? t.price_total.toFixed(2).replace(".", ",") : ""} className="field tnum" />
                </Field>
                <Field label="Valor por sessão (R$)">
                  <input name="session_price" inputMode="decimal" defaultValue={t.session_price !== null ? t.session_price.toFixed(2).replace(".", ",") : ""} className="field tnum" />
                </Field>
                <Field label="Intervalo (dias)">
                  <input name="interval_days" type="number" min={1} max={365} defaultValue={t.interval_days ?? ""} className="field tnum" />
                </Field>
                <Field label="Válido até">
                  <input name="valid_until" type="date" defaultValue={t.valid_until ?? ""} className="field tnum" />
                </Field>
                <Field label="Frequência (texto livre)" className="sm:col-span-2">
                  <input name="frequency_note" defaultValue={t.frequency_note ?? ""} maxLength={200} className="field" />
                </Field>
                <Field label="Observações" className="sm:col-span-2">
                  <textarea name="notes" defaultValue={t.notes ?? ""} rows={3} maxLength={2000} className="field" />
                </Field>
              </AdminForm>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
