import { createPlanAction } from "@/app/admin/(painel)/financeiro/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { PaymentRow } from "@/components/admin/finance/payment-row";
import { ReceivableForm } from "@/components/admin/finance/receivable-form";
import { MethodOptions } from "@/components/admin/finance/receive-form";
import { Empty, Field } from "@/components/admin/ui";
import type { ClientFile } from "@/lib/client-file";
import { paymentView, queryString, sumMoney } from "@/lib/finance";
import { formatMoney } from "@/lib/format";

interface Props {
  file: ClientFile;
  today: string;
  /** Recebimento aberto para "Receber" (vem da URL). */
  receiving?: string;
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-t border-linha pt-3">
      <dt className="t-small">{label}</dt>
      <dd className="tnum mt-1 text-[1.35rem]">{formatMoney(value)}</dd>
    </div>
  );
}

/** O que a cliente pagou, deve e está atrasada; gerar parcelas do tratamento; lançar um recebimento. */
export function FinanceTab({ file, today, receiving }: Props) {
  const { client, payments, treatments } = file;
  const at = (extra: Record<string, string> = {}) => `/admin/clientes/${client.id}${queryString({ aba: "financeiro", ...extra })}`;
  const base = at();
  const sum = (view: ReturnType<typeof paymentView>) => sumMoney(payments.filter((p) => paymentView(p, today) === view).map((p) => p.amount));

  // Tratamento com valor definido e ainda sem cobrança ativa: dá para gerar as parcelas.
  const billable = treatments.filter(
    (t) => t.status !== "cancelled" && t.price_total !== null && t.price_total > 0 && !payments.some((p) => p.treatment_id === t.id && p.kind === "treatment" && (p.status === "pending" || p.status === "paid")),
  );

  return (
    <div className="grid gap-x-12 gap-y-14 xl:grid-cols-2">
      <div className="grid content-start gap-12">
        <section aria-labelledby="fin-resumo">
          <h2 id="fin-resumo" className="t-h3 mb-4">
            Em resumo
          </h2>
          <dl className="grid max-w-xl grid-cols-3 gap-x-6">
            <Figure label="Recebido" value={sum("paid")} />
            <Figure label="A receber" value={sum("pending")} />
            <Figure label="Atrasado" value={sum("overdue")} />
          </dl>
        </section>

        <section aria-labelledby="fin-lista">
          <h2 id="fin-lista" className="t-h3 mb-4">
            Cobranças
          </h2>
          {payments.length === 0 ? (
            <Empty>Nenhuma cobrança para esta cliente.</Empty>
          ) : (
            <ul className="border-t border-linha">
              {payments.map((p) => (
                <PaymentRow
                  key={p.id}
                  p={p}
                  client={client}
                  hideClient
                  compact
                  today={today}
                  back={base}
                  receiveHref={at({ receber: p.id })}
                  receiving={receiving === p.id}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid content-start gap-12">
        {billable.length > 0 && (
          <section aria-labelledby="fin-plano">
            <h2 id="fin-plano" className="t-h3 mb-2">
              Gerar parcelas do tratamento
            </h2>
            <p className="t-small mb-4 max-w-[52ch]">Divide o valor do tratamento em parcelas mensais. A última absorve os centavos.</p>
            <div className="grid gap-8">
              {billable.map((t) => (
                <AdminForm key={t.id} action={createPlanAction} submitLabel="Gerar parcelas" className="grid max-w-lg gap-4 sm:grid-cols-2">
                  <input type="hidden" name="treatment_id" value={t.id} />
                  <p className="sm:col-span-2">
                    <span className="font-medium">{t.name}</span> <span className="tnum t-small">{formatMoney(t.price_total ?? 0)}</span>
                  </p>
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
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="fin-novo">
          <h2 id="fin-novo" className="t-h3 mb-4">
            Novo recebimento
          </h2>
          <ReceivableForm clients={[client]} treatments={treatments.filter((t) => t.status !== "cancelled")} lockedClient={client} />
        </section>
      </div>
    </div>
  );
}
