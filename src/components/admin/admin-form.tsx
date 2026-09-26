"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/admin-util";

interface AdminFormProps {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  /** Limpa os campos depois de salvar (formulários de criação). */
  resetOnSuccess?: boolean;
  /** Esconde o botão principal (quando o form só tem controles próprios). */
  hideSubmit?: boolean;
}

/** Formulário de painel: envia por server action e mostra o resultado numa linha de status. */
export function AdminForm({ action, children, submitLabel = "Salvar", className = "", resetOnSuccess = false, hideSubmit = false }: AdminFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="col-span-full mt-5 flex flex-wrap items-center gap-4">
        {!hideSubmit && (
          <button type="submit" className="btn btn-sm" disabled={pending}>
            {pending ? "Salvando…" : submitLabel}
          </button>
        )}
        <p role="status" aria-live="polite" className={`text-[0.9rem] ${state?.error ? "text-alerta" : "text-bisturi"}`}>
          {state?.error ?? state?.message ?? ""}
        </p>
      </div>
    </form>
  );
}
