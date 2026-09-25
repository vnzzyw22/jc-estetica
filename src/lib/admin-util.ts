import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { DbError, type Db } from "@/lib/data/db";

export type ActionState = { ok?: boolean; message?: string; error?: string } | null;

const DB_MESSAGE: Record<string, string> = {
  "23505": "Já existe um registro com esse valor (nome, endereço ou telefone repetido).",
  "23P01": "Esse horário conflita com outro agendamento.",
  "23503": "Existem registros vinculados. Desative em vez de excluir.",
  "23001": "Existem registros vinculados (agendamentos, tratamentos ou pagamentos). Desative em vez de excluir.",
  not_configured: "Supabase não configurado: alterações indisponíveis neste ambiente.",
  blocked: "Esse horário está bloqueado na agenda.",
  service_not_found: "Procedimento não encontrado.",
  invalid_name: "Informe o nome do cliente.",
  invalid_phone: "Informe um telefone válido com DDD.",
  upload_failed: "Não foi possível enviar a imagem. Use JPG, PNG ou WebP de até 5 MB.",
  // Financeiro
  invalid_amount: "Informe um valor maior que zero.",
  invalid_installments: "O número de parcelas deve ficar entre 1 e 36.",
  paid_needs_single: "Só é possível registrar como já recebido um pagamento em parcela única.",
  paid_in_future: "A data do recebimento não pode estar no futuro.",
  client_mismatch: "O tratamento ou atendimento escolhido é de outra cliente.",
  client_not_found: "Cliente não encontrada.",
  description_required: "Descreva o que está sendo cobrado.",
  method_required: "Escolha a forma de pagamento para registrar o recebimento.",
  invalid_status: "Esse recebimento não pode mudar para esse estado agora. Atualize a página.",
  payment_not_found: "Recebimento não encontrado.",
  treatment_not_found: "Tratamento não encontrado.",
  appointment_not_found: "Atendimento não encontrado.",
  no_price: "Este tratamento não tem valor definido.",
  plan_exists: "Este tratamento já tem parcelas geradas.",
  "22003": "O valor é grande demais.",
  "23514": "Algum valor está fora do permitido. Confira os campos.",
};

/**
 * Executa uma ação administrativa: exige admin, traduz erros do banco em mensagem
 * legível e revalida as rotas afetadas. Retorna o estado para useActionState.
 */
export async function guarded(fn: (db: Db) => Promise<string | void>, revalidate: string[] = []): Promise<ActionState> {
  const { db } = await requireAdmin();
  try {
    const message = await fn(db);
    for (const path of revalidate) revalidatePath(path, path === "/" ? "layout" : "page");
    revalidatePath("/admin", "layout");
    return { ok: true, message: message ?? "Salvo." };
  } catch (err) {
    if (err instanceof DbError) return { error: DB_MESSAGE[err.code] ?? err.message };
    console.error("[admin action]", err);
    return { error: "Não foi possível concluir. Tente novamente." };
  }
}

export const str = (fd: FormData, key: string): string => String(fd.get(key) ?? "").trim();
export const optStr = (fd: FormData, key: string): string | null => str(fd, key) || null;
export const bool = (fd: FormData, key: string): boolean => fd.get(key) === "on";

export function num(fd: FormData, key: string, fallback = 0): number {
  const raw = str(fd, key).replace(",", ".");
  const n = Number(raw);
  return raw !== "" && Number.isFinite(n) ? n : fallback;
}

export function optNum(fd: FormData, key: string): number | null {
  const raw = str(fd, key).replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Só aceita imagem de até 5 MB; devolve null se o campo veio vazio. */
export function imageFile(fd: FormData, key: string): File | null {
  const file = fd.get(key);
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) throw new DbError("upload_failed");
  return file;
}
