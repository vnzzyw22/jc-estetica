"use client";

import { useActionState } from "react";
import { saveAnamnesisAction } from "@/app/admin/(painel)/clientes/[id]/actions";
import { ANAMNESIS_FIELDS, MAX_LEN } from "@/lib/anamnesis";
import type { Anamnesis } from "@/lib/types";

/** Anamnese em rascunho: dois botões, "Salvar rascunho" e "Concluir anamnese". */
export function AnamnesisForm({ anamnesis, today }: { anamnesis: Anamnesis; today: string }) {
  const [state, action, pending] = useActionState(saveAnamnesisAction, null);

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="id" value={anamnesis.id} />

      <div className="max-w-56">
        <label htmlFor="assessed_at" className="mb-1.5 block text-[0.9rem] font-medium">
          Data da avaliação
        </label>
        <input id="assessed_at" name="assessed_at" type="date" max={today} defaultValue={anamnesis.assessed_at?.slice(0, 10) ?? ""} className="field tnum" />
      </div>

      {ANAMNESIS_FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={f.key} className="mb-1.5 block text-[0.9rem] font-medium">
            {f.label}
          </label>
          {f.hint && (
            <p id={`${f.key}-hint`} className="t-small mb-2">
              {f.hint}
            </p>
          )}
          <textarea id={f.key} name={f.key} rows={f.rows} maxLength={MAX_LEN} defaultValue={anamnesis[f.key] ?? ""} aria-describedby={f.hint ? `${f.key}-hint` : undefined} className="field resize-y" />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button type="submit" name="intent" value="draft" className="btn btn-sm btn-ghost" disabled={pending}>
          {pending ? "Salvando…" : "Salvar rascunho"}
        </button>
        <button type="submit" name="intent" value="complete" className="btn btn-sm" disabled={pending}>
          Concluir anamnese
        </button>
        <p role="status" aria-live="polite" className={`text-[0.9rem] ${state?.error ? "text-alerta" : "text-bisturi"}`}>
          {state?.error ?? state?.message ?? ""}
        </p>
      </div>
      <p className="t-small max-w-[60ch]">Registro de acompanhamento para uso profissional. Não é diagnóstico médico. Ao concluir, ele fica somente leitura; para alterar, reabra.</p>
    </form>
  );
}
