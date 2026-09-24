"use server";

import { bool, guarded, num, str, type ActionState } from "@/lib/admin-util";

const PATHS = ["/", "/faq", "/admin/faq"];

export async function saveFaqAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const question = str(fd, "question");
  const answer = str(fd, "answer");
  if (!question || !answer) return { error: "Preencha a pergunta e a resposta." };
  const id = str(fd, "id");

  return guarded(async (db) => {
    const row = { question, answer, display_order: Math.round(num(fd, "display_order", 0)), active: bool(fd, "active") };
    if (id) await db.update("faq", id, row);
    else await db.insert("faq", row);
    return id ? "Pergunta salva." : "Pergunta adicionada.";
  }, PATHS);
}

export async function deleteFaqAction(fd: FormData): Promise<void> {
  await guarded((db) => db.remove("faq", str(fd, "id")), PATHS);
}
