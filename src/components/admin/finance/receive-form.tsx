import Link from "next/link";
import { receivePaymentAction } from "@/app/admin/(painel)/financeiro/actions";
import { Field } from "@/components/admin/ui";
import { PAYMENT_METHOD_LABEL } from "@/lib/format";
import type { Payment } from "@/lib/types";

/** Opções de forma de pagamento. Obrigatória: a primeira opção é desabilitada. Opcional: "Definir depois". */
export function MethodOptions({ optional = false }: { optional?: boolean }) {
  return (
    <>
      {optional ? (
        <option value="">Definir depois</option>
      ) : (
        <option value="" disabled>
          Escolha…
        </option>
      )}
      {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </>
  );
}

interface ReceiveFormProps {
  p: Payment;
  today: string;
  /** Para onde voltar depois de receber (ou de errar). */
  back: string;
  /** Se informado, mostra o link "Fechar" (na lista o formulário abre e fecha pela URL). */
  closeHref?: string;
}

/** "Receber": forma de pagamento (obrigatória) e a data em que o dinheiro entrou. */
export function ReceiveForm({ p, today, back, closeHref }: ReceiveFormProps) {
  return (
    <form action={receivePaymentAction} className="grid max-w-2xl items-end gap-4 border-l-2 border-bisturi pl-4 sm:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="id" value={p.id} />
      <input type="hidden" name="back" value={back} />
      <Field label="Forma de pagamento">
        <select name="method" required defaultValue={p.method ?? ""} className="field">
          <MethodOptions />
        </select>
      </Field>
      <Field label="Data do recebimento">
        <input type="date" name="date" defaultValue={today} max={today} required className="field tnum" />
      </Field>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-sm">
          Confirmar recebimento
        </button>
        {closeHref && (
          <Link href={closeHref} scroll={false} className="link-draw text-[0.9rem]">
            Fechar
          </Link>
        )}
      </div>
    </form>
  );
}
