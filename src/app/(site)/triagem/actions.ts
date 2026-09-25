"use server";

import { headers } from "next/headers";
import { getPublicDb } from "@/lib/data";
import { DbError } from "@/lib/data/db";
import { isHoneypotTripped, isIpRateLimited, isTooFast, verifyTurnstile } from "@/lib/antispam";
import { FIELD_STEP, normalizeCampaign, normalizeSource, validateScreening, type FieldErrors, type ScreeningInput } from "@/lib/screening";

export interface SubmitScreeningInput {
  /** Respostas da pessoa (tudo é revalidado aqui e de novo no banco). */
  fields: ScreeningInput;
  /** Parâmetros de origem capturados do link (?origem=instagram). */
  origin?: { source?: string; campaign?: string };
  /** Campo-isca (deve chegar vazio) e instante em que o formulário abriu. */
  honeypot?: string;
  startedAt?: number;
  /** Token do Turnstile, quando ativado. */
  turnstileToken?: string;
}

export type SubmitScreeningResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: FieldErrors; step?: number };

const MESSAGE: Record<string, string> = {
  invalid_name: "Informe seu nome.",
  invalid_phone: "Informe o WhatsApp com DDD.",
  consent_required: "Para enviar, é preciso concordar com o termo.",
  consent_term_missing: "A triagem ainda não está aberta para envios. Fale com a Jennifer pelo WhatsApp.",
  too_many: "Já recebemos suas respostas. Aguarde o contato da Jennifer ou fale pelo WhatsApp.",
  not_configured: "A triagem ainda não está ativa neste ambiente.",
};

const GENERIC = "Não foi possível enviar agora. Tente de novo em instantes ou fale pelo WhatsApp.";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip")) || null;
}

export async function submitScreening(input: SubmitScreeningInput): Promise<SubmitScreeningResult> {
  // 1) Anti-spam. O campo-isca preenchido finge sucesso: não ensinamos o bot.
  if (isHoneypotTripped(input.honeypot)) return { ok: true };
  if (isTooFast(input.startedAt)) return { ok: false, error: "Você foi muito rápida! Revise as respostas e envie de novo." };

  // 2) Validação de servidor (a do navegador é só conforto). Erros de digitação não gastam a cota do IP.
  const parsed = validateScreening(input.fields ?? {});
  if (!parsed.ok) {
    const first = Math.min(...(Object.keys(parsed.errors) as Array<keyof ScreeningInput>).map((k) => FIELD_STEP[k]));
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: parsed.errors, step: first };
  }
  const v = parsed.value;

  const ip = await clientIp();
  if (isIpRateLimited(ip)) return { ok: false, error: MESSAGE.too_many };
  const challenge = await verifyTurnstile(input.turnstileToken, ip);
  if (!challenge.ok) return { ok: false, error: "Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo." };

  const source = normalizeSource(input.origin?.source);
  const campaign = normalizeCampaign(input.origin?.campaign);

  // 3) Gravação: única via é a função segura do banco (valida de novo, checa termo e limite por telefone).
  try {
    await getPublicDb().rpc("submit_screening", {
      p_name: v.name,
      p_phone: v.phone,
      p_email: v.email,
      p_source: source,
      p_source_detail: campaign,
      p_interest_area: v.area,
      p_goal: v.goal,
      p_complaint: v.complaint,
      p_desired_outcome: v.desiredOutcome,
      p_answers: v.answers,
      p_consent: true,
    });
    return { ok: true };
  } catch (err) {
    const code = err instanceof DbError ? err.code : "unknown";
    if (!(code in MESSAGE)) console.error("[submitScreening]", err);
    return { ok: false, error: MESSAGE[code] ?? GENERIC };
  }
}
