"use server";

import { redirect } from "next/navigation";
import { guarded, optStr, str, type ActionState } from "@/lib/admin-util";
import { validateAnamnesis, type AnamnesisIntent } from "@/lib/anamnesis";
import { todayISO } from "@/lib/date";

const PATHS = ["/admin/clientes", "/admin/triagens", "/admin/dashboard"];

const back = (clientId: string, extra = "") => `/admin/clientes/${clientId}?aba=anamnese${extra}`;

/** Abre uma anamnese em rascunho. Reavaliação = nova anamnese; a anterior fica no histórico. */
export async function startAnamnesisAction(fd: FormData): Promise<void> {
  const clientId = str(fd, "client_id");
  const screeningId = optStr(fd, "screening_id");
  let createdId = "";

  const res = await guarded(async (db) => {
    const client = await db.get("clients", clientId);
    if (!client) throw new Error("cliente não encontrada");
    const created = await db.insert("anamneses", { client_id: clientId, screening_id: screeningId, status: "draft" });
    createdId = created.id;
  }, PATHS);

  if (res?.error) redirect(back(clientId, `&erro=${encodeURIComponent(res.error.includes("conflita") || res.error.includes("repetido") ? "Já existe uma anamnese em rascunho. Conclua ou continue a atual." : res.error)}`));
  redirect(back(clientId, `&id=${createdId}`));
}

/** Salva como rascunho ou conclui, conforme o botão apertado (`intent`). */
export async function saveAnamnesisAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const intent = (str(fd, "intent") === "complete" ? "complete" : "draft") as AnamnesisIntent;
  const parsed = validateAnamnesis(
    {
      assessed_at: fd.get("assessed_at"),
      evaluation: fd.get("evaluation"),
      relevant_history: fd.get("relevant_history"),
      contraindications: fd.get("contraindications"),
      additional_info: fd.get("additional_info"),
      professional_notes: fd.get("professional_notes"),
    },
    intent,
    todayISO(),
  );
  if (!parsed.ok) return { error: Object.values(parsed.errors).join(" ") };

  return guarded(async (db) => {
    const id = str(fd, "id");
    const current = await db.get("anamneses", id);
    if (!current) throw new Error("anamnese não encontrada");
    if (current.status === "completed") throw new Error("anamnese já concluída: reabra para editar");
    await db.update("anamneses", id, { ...parsed.value, status: intent === "complete" ? "completed" : "draft" });
    return intent === "complete" ? "Anamnese concluída." : "Rascunho salvo.";
  }, PATHS);
}

export async function reopenAnamnesisAction(fd: FormData): Promise<void> {
  const clientId = str(fd, "client_id");
  const id = str(fd, "id");
  const res = await guarded(async (db) => {
    await db.update("anamneses", id, { status: "draft" });
  }, PATHS);
  if (res?.error) redirect(back(clientId, `&id=${id}&erro=${encodeURIComponent("Já existe outra anamnese em rascunho. Conclua-a antes de reabrir esta.")}`));
  redirect(back(clientId, `&id=${id}`));
}
