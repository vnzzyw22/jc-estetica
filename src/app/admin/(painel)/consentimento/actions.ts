"use server";

import { bool, guarded, str, type ActionState } from "@/lib/admin-util";

const PATHS = ["/admin/consentimento", "/triagem"];

/**
 * Registra o texto OFICIAL do consentimento da triagem, fornecido pela Jennifer/responsável.
 * O sistema não escreve nem sugere texto jurídico.
 * Publicar é atômico: o texto entra como rascunho e a função do banco troca o termo em vigor de uma vez.
 * Se algo falhar no meio, o termo anterior continua valendo (a triagem nunca fica sem termo).
 */
export async function saveTermAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const version = str(fd, "version");
  const body = str(fd, "body");
  if (!version || version.length > 40) return { error: "Informe a versão do termo (ex.: 2026-10)." };
  if (body.length < 40) return { error: "O texto do termo está curto demais. Cole o texto oficial completo." };
  if (body.length > 20000) return { error: "O texto passou de 20 mil caracteres." };
  const publish = bool(fd, "publish");

  return guarded(async (db) => {
    const created = await db.insert("consent_terms", { kind: "screening", version, body, active: false, published_at: null });
    if (publish) await db.rpc("activate_consent_term", { p_term_id: created.id });
    return publish ? "Termo publicado. A triagem já usa esta versão." : "Rascunho salvo. Ele só vale depois de publicado.";
  }, PATHS);
}

export async function activateTermAction(fd: FormData): Promise<void> {
  await guarded(async (db) => {
    await db.rpc("activate_consent_term", { p_term_id: str(fd, "id") });
  }, PATHS);
}
