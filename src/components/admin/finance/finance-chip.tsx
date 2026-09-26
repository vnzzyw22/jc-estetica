import { PAYMENT_VIEW_LABEL } from "@/lib/format";
import type { PaymentView } from "@/lib/finance";

const TONE = {
  ok: "border-bisturi text-bisturi",
  open: "border-cafe text-cafe",
  late: "border-alerta text-alerta",
  muted: "border-linha text-cafe/60 line-through",
} as const;

type Tone = keyof typeof TONE;

/** Estado de um recebimento ou despesa. O texto diz o estado; a cor só reforça. */
export function FinanceChip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-block w-fit rounded-ctl border px-2 py-0.5 text-[0.8125rem] ${TONE[tone]}`}>{children}</span>;
}

const PAYMENT_TONE: Record<PaymentView, Tone> = { paid: "ok", pending: "open", overdue: "late", cancelled: "muted", refunded: "muted" };

export function PaymentChip({ view }: { view: PaymentView }) {
  return <FinanceChip tone={PAYMENT_TONE[view]}>{PAYMENT_VIEW_LABEL[view]}</FinanceChip>;
}

export function ExpenseChip({ paid, overdue }: { paid: boolean; overdue: boolean }) {
  if (paid) return <FinanceChip tone="ok">Paga</FinanceChip>;
  return overdue ? <FinanceChip tone="late">Atrasada</FinanceChip> : <FinanceChip tone="open">A pagar</FinanceChip>;
}
