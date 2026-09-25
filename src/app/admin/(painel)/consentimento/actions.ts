"use server";

import { bool, guarded, str, type ActionState } from "@/lib/admin-util";
import type { Db } from "@/lib/data/db";

const PATHS = ["/admin/consentimento", "/triagem"];

/** Só um termo pode estar em vigor por vez (o banco também garante). */
async function deactivateCurrent(db: Db): Promise<void> {
  const current = await db.list("consent_terms", { eq: { kind: "screening", active: true } });
  for (const t of current) await db.update("consent_terms", t.id, { active: false });
}

/**
 * Registra o texto OFICIAL do consentimento da triagem, fornecido pela Jennifer/responsável.
 * O sistema não escreve nem sugere texto jurídico.
 */
export async function saveTermAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const version = str(fd, "version");
  const body = str(fd, "body");
  if (!version || version.length > 40) return { error: "Informe a versão do termo (ex.: 2026-10)." };
  if (body.length < 40) return { error: "O texto do termo está curto demais. Cole o texto oficial completo." };
  if (body.length > 20000) return { error: "O texto passou de 20 mil caracteres." };
  const publish = bool(fd, "publish");

  return guarded(async (db) => {
    if (publish) await deactivateCurrent(db);
    await db.insert("consent_terms", { kind: "screening", version, body, active: publish, published_at: publish ? new Date().toISOString() : null });
    return publish ? "Termo publicado. A triagem já usa esta versão." : "Rascunho salvo. Ele só vale depois de publicado.";
  }, PATHS);
}

export async function activateTermAction(fd: FormData): Promise<void> {
  await guarded(async (db) => {
    await deactivateCurrent(db);
    await db.update("consent_terms", str(fd, "id"), { active: true, published_at: new Date().toISOString() });
  }, PATHS);
}
