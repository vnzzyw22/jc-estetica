import Link from "next/link";
import { paymentStatusAction } from "@/app/admin/(painel)/financeiro/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PaymentChip } from "@/components/admin/finance/finance-chip";
import { ReceiveForm } from "@/components/admin/finance/receive-form";
import { dateBR } from "@/lib/date";
import { paymentDate } from "@/lib/finance-data";
import { daysLate, installmentLabel, paymentView } from "@/lib/finance";
import { PAYMENT_KIND_LABEL, PAYMENT_METHOD_LABEL, formatMoney } from "@/lib/format";
import type { Client, Payment } from "@/lib/types";
import { whatsappLink } from "@/lib/whatsapp";

interface PaymentRowProps {
  p: Payment;
  client: Client | null;
  today: string;
  /** Para onde voltar depois de uma ação de linha (a própria lista, com os filtros). */
  back: string;
  /** Endereço da lista com este recebimento aberto para receber. */
  receiveHref: string;
  /** Formulário "Receber" aberto nesta linha. */
  receiving: boolean;
  /** Na ficha da cliente o nome dela é redundante. */
  hideClient?: boolean;
  /** Para colunas estreitas (ficha da cliente): valor e estado à direita, sem a grade de 4 colunas. */
  compact?: boolean;
}

function StatusForm({ id, to, back, label, confirm, danger }: { id: string; to: "pending" | "cancelled"; back: string; label: string; confirm?: string; danger?: boolean }) {
  return (
    <form action={paymentStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="back" value={back} />
      <ConfirmButton confirm={confirm} className={`link-draw text-[0.9rem] ${danger ? "text-alerta" : ""}`}>
        {label}
      </ConfirmButton>
    </form>
  );
}

/** Uma linha de recebimento: o quê, de quem, quando, quanto, em que estado, e o que fazer agora. */
export function PaymentRow({ p, client, today, back, receiveHref, receiving, hideClient = false, compact = false }: PaymentRowProps) {
  const c = (classes: string) => (compact ? classes : "");
  const view = paymentView(p, today);
  const parcel = installmentLabel(p);
  const late = view === "overdue" ? daysLate(p.due_date, today) : 0;
  const when = p.status === "paid" && p.paid_at ? `Recebido em ${dateBR(paymentDate(p))}` : `Vence em ${dateBR(p.due_date)}`;
  const first = client?.name.split(" ")[0];
  const charge =
    client && (view === "overdue" || view === "pending")
      ? whatsappLink(client.phone, `Olá, ${first}! Passando para lembrar do pagamento de ${formatMoney(p.amount)}${p.description ? ` (${p.description})` : ""}, com vencimento em ${dateBR(p.due_date)}.`)
      : null;

  return (
    <li className="border-b border-linha py-4">
      <div className={compact ? "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1" : "grid gap-x-6 gap-y-1 lg:grid-cols-[minmax(0,1fr)_11rem_8rem_6.5rem] lg:items-baseline"}>
        <div className={`min-w-0 ${c("col-start-1 row-start-1")}`}>
          <Link href={`/admin/financeiro/recebimentos/${p.id}`} className="link-draw font-medium">
            {p.description ?? "Recebimento"}
          </Link>
          {parcel && <span className="tnum t-small ml-2 whitespace-nowrap">parcela {parcel}</span>}
          <p className="t-small truncate">
            {!hideClient && (client ? <Link href={`/admin/clientes/${client.id}?aba=financeiro`} className="link-draw">{client.name}</Link> : "Sem cliente")}
            {!hideClient && " · "}
            {PAYMENT_KIND_LABEL[p.kind]}
          </p>
        </div>
        <p className={`t-small tnum ${c("col-start-1 row-start-2")}`}>
          {when}
          {p.method && <span className="block">{PAYMENT_METHOD_LABEL[p.method]}</span>}
          {late > 0 && <span className="block text-alerta">{late} dia{late === 1 ? "" : "s"} de atraso</span>}
        </p>
        <p className={`tnum font-medium ${compact ? "col-start-2 row-start-1 text-right" : "lg:text-right"}`}>{formatMoney(p.amount)}</p>
        <div className={compact ? "col-start-2 row-start-2 text-right" : "lg:text-right"}>
          <PaymentChip view={view} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-5">
        {p.status === "pending" && (
          <>
            <Link href={receiveHref} scroll={false} className="link-draw min-h-9 text-[0.9rem] font-medium text-bisturi">
              Receber
            </Link>
            {charge && (
              <a href={charge} target="_blank" rel="noopener noreferrer" className="link-draw min-h-9 text-[0.9rem]">
                Cobrar no WhatsApp
              </a>
            )}
            <StatusForm id={p.id} to="cancelled" back={back} label="Cancelar cobrança" confirm="Cancelar esta cobrança? Ela sai do caixa; dá para restaurar depois." />
          </>
        )}
        {p.status === "paid" && <StatusForm id={p.id} to="pending" back={back} label="Desfazer recebimento" confirm="Desfazer o recebimento? O valor volta para “a receber”." />}
        {p.status === "cancelled" && <StatusForm id={p.id} to="pending" back={back} label="Restaurar cobrança" />}
      </div>

      {receiving && p.status === "pending" && (
        <div className="mt-4">
          <ReceiveForm p={p} today={today} back={back} closeHref={back} />
        </div>
      )}
    </li>
  );
}
