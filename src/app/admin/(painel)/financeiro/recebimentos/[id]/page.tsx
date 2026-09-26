import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePaymentAction, paymentStatusAction, updatePaymentAction } from "@/app/admin/(painel)/financeiro/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PaymentChip } from "@/components/admin/finance/finance-chip";
import { Notice } from "@/components/admin/finance/notice";
import { MethodOptions, ReceiveForm } from "@/components/admin/finance/receive-form";
import { Field } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { dateBR, dateISOFromEpoch, todayISO } from "@/lib/date";
import { daysLate, installmentLabel, paymentView } from "@/lib/finance";
import { paymentDate } from "@/lib/finance-data";
import { KIND_LABEL, PAYMENT_KIND_LABEL, PAYMENT_METHOD_LABEL, formatMoney } from "@/lib/format";

export const metadata = { title: "Recebimento" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; aviso?: string }> };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-linha py-3">
      <dt className="t-small">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

export default async function ReceivableDetailPage({ params, searchParams }: Props) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.get("payments", id).catch(() => null);
  if (!p) notFound();

  const today = todayISO();
  const here = `/admin/financeiro/recebimentos/${p.id}`;
  const view = paymentView(p, today);

  const [client, treatment, appointment, sameDescription] = await Promise.all([
    p.client_id ? db.get("clients", p.client_id) : null,
    p.treatment_id ? db.get("treatments", p.treatment_id) : null,
    p.appointment_id ? db.get("appointments", p.appointment_id) : null,
    p.installment_total > 1 && p.description ? db.list("payments", { eq: { description: p.description } }) : [],
  ]);
  const service = appointment?.service_id ? await db.get("services", appointment.service_id) : null;
  const siblings = sameDescription
    .filter((s) => s.installment_total === p.installment_total && s.client_id === p.client_id && s.kind === p.kind)
    .sort((a, b) => a.installment_number - b.installment_number);
  const parcel = installmentLabel(p);
  const late = view === "overdue" ? daysLate(p.due_date, today) : 0;
  const paidOn = p.status === "paid" && p.paid_at ? paymentDate(p) : "";

  return (
    <>
      <Notice erro={sp.erro} aviso={sp.aviso} />
      <p className="mb-6">
        <Link href="/admin/financeiro/recebimentos" className="link-draw text-[0.9rem]">
          Voltar aos recebimentos
        </Link>
      </p>

      <div className="grid gap-x-12 gap-y-12 xl:grid-cols-2">
        <section aria-labelledby="dados" className="grid content-start gap-8">
          <div>
            <h2 id="dados" className="t-h2">
              {p.description ?? "Recebimento"}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <PaymentChip view={view} />
              {parcel && <span className="tnum t-small">parcela {parcel}</span>}
            </div>
          </div>

          <dl className="tnum border-t border-linha">
            <Fact label="Valor">{formatMoney(p.amount)}</Fact>
            <Fact label="Vencimento">
              {dateBR(p.due_date)}
              {late > 0 && <span className="block text-alerta">{late} dia{late === 1 ? "" : "s"} de atraso</span>}
            </Fact>
            {paidOn && <Fact label="Recebido em">{dateBR(paidOn)}</Fact>}
            <Fact label="Forma de pagamento">{p.method ? PAYMENT_METHOD_LABEL[p.method] : "Não informada"}</Fact>
            <Fact label="Tipo">{PAYMENT_KIND_LABEL[p.kind]}</Fact>
            <Fact label="Cliente">
              {client ? (
                <Link href={`/admin/clientes/${client.id}?aba=financeiro`} className="link-draw">
                  {client.name}
                </Link>
              ) : (
                "Sem cliente"
              )}
            </Fact>
            {treatment && <Fact label="Tratamento">{treatment.name}</Fact>}
            {appointment && (
              <Fact label="Atendimento">
                <Link href={`/admin/agendamentos/${appointment.id}`} className="link-draw">
                  {service?.name ?? KIND_LABEL[appointment.kind]}, {dateBR(dateISOFromEpoch(Date.parse(appointment.starts_at)))}
                </Link>
              </Fact>
            )}
          </dl>

          {p.status === "pending" && (
            <div>
              <h3 className="t-h3 mb-3">Receber</h3>
              <ReceiveForm p={p} today={today} back={here} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {p.status === "pending" && (
              <form action={paymentStatusAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="to" value="cancelled" />
                <input type="hidden" name="back" value={here} />
                <ConfirmButton confirm="Cancelar esta cobrança? Ela sai do caixa; dá para restaurar depois.">Cancelar cobrança</ConfirmButton>
              </form>
            )}
            {p.status === "paid" && (
              <form action={paymentStatusAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="to" value="pending" />
                <input type="hidden" name="back" value={here} />
                <ConfirmButton confirm="Desfazer o recebimento? O valor volta para “a receber”.">Desfazer recebimento</ConfirmButton>
              </form>
            )}
            {p.status === "cancelled" && (
              <form action={paymentStatusAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="to" value="pending" />
                <input type="hidden" name="back" value={here} />
                <ConfirmButton>Restaurar cobrança</ConfirmButton>
              </form>
            )}
          </div>
        </section>

        <div className="grid content-start gap-12">
          <section aria-labelledby="editar">
            <h2 id="editar" className="t-h3 mb-4">
              Editar
            </h2>
            <AdminForm action={updatePaymentAction} submitLabel="Salvar alterações" className="grid max-w-lg gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={p.id} />
              <Field label="Descrição" className="sm:col-span-2">
                <input name="description" defaultValue={p.description ?? ""} maxLength={200} className="field" />
              </Field>
              <Field label="Valor (R$)" hint={p.status === "pending" ? undefined : "Só cobranças a receber."}>
                <input name="amount" inputMode="decimal" defaultValue={String(p.amount).replace(".", ",")} disabled={p.status !== "pending"} className="field tnum" />
              </Field>
              <Field label="Vencimento" hint={p.status === "pending" ? undefined : "Só cobranças a receber."}>
                <input name="due_date" type="date" defaultValue={p.due_date} disabled={p.status !== "pending"} className="field tnum" />
              </Field>
              {p.status === "paid" && (
                <Field label="Recebido em">
                  <input name="paid_date" type="date" defaultValue={paidOn} max={today} className="field tnum" />
                </Field>
              )}
              <Field label="Forma de pagamento">
                <select name="method" defaultValue={p.method ?? ""} required={p.status === "paid"} className="field">
                  <MethodOptions optional={p.status !== "paid"} />
                </select>
              </Field>
              <Field label="Observações" className="sm:col-span-2">
                <textarea name="notes" defaultValue={p.notes ?? ""} rows={3} maxLength={400} className="field" />
              </Field>
            </AdminForm>

            {p.status === "paid" ? (
              <p className="t-small mt-6 max-w-[52ch]">Um recebimento já pago é histórico do caixa. Para excluir, desfaça o recebimento antes.</p>
            ) : (
              <form action={deletePaymentAction} className="mt-8">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="back" value="/admin/financeiro/recebimentos" />
                <ConfirmButton confirm="Excluir esta cobrança definitivamente?" className="link-draw text-[0.9rem] text-alerta">
                  Excluir cobrança
                </ConfirmButton>
              </form>
            )}
          </section>

          {siblings.length > 1 && (
            <section aria-labelledby="parcelas">
              <h2 id="parcelas" className="t-h3 mb-4">
                Parcelas
              </h2>
              <ul className="border-t border-linha">
                {siblings.map((s) => (
                  <li key={s.id} className="border-b border-linha">
                    <Link
                      href={`/admin/financeiro/recebimentos/${s.id}`}
                      aria-current={s.id === p.id ? "true" : undefined}
                      className={`grid grid-cols-[3rem_1fr_auto_auto] items-baseline gap-x-4 py-3 transition-colors hover:bg-seda/60 ${s.id === p.id ? "font-medium" : ""}`}
                    >
                      <span className="tnum t-small">{installmentLabel(s)}</span>
                      <span className="tnum">{dateBR(s.due_date)}</span>
                      <span className="tnum">{formatMoney(s.amount)}</span>
                      <PaymentChip view={paymentView(s, today)} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
