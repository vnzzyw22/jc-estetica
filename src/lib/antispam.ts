// Proteções contra abuso da triagem pública. Todas são gratuitas e independentes de serviço pago.
// Camadas hoje:
//   1) honeypot + tempo mínimo de preenchimento (contra bots simples);
//   2) limite por telefone (no banco: 3 em 24 h);
//   3) limite por IP em memória (melhor esforço: em serverless cada instância tem a sua contagem);
//   4) Turnstile (Cloudflare, plano gratuito): DESLIGADO até existirem as chaves.
//
// ANTES DE DIVULGAR O LINK AMPLAMENTE: ativar o Turnstile (variáveis abaixo) e/ou trocar o passo 3
// por um limitador compartilhado (ex.: Upstash/Vercel KV), que não é necessário para desenvolver.
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY  chave pública do widget
//   TURNSTILE_SECRET_KEY            chave secreta (só servidor)

const MIN_FILL_MS = 4000;
const WINDOW_MS = 60 * 60 * 1000;
// Generoso de propósito: redes móveis e escritórios compartilham IP. O freio fino é por telefone (banco).

const MAX_PER_WINDOW = 12;

const hits = new Map<string, number[]>();

/** Campo-isca: humanos não veem nem preenchem. */
export const isHoneypotTripped = (value: unknown): boolean => typeof value === "string" && value.trim() !== "";

/** Cinco passos não se preenchem em menos de alguns segundos. */
export const isTooFast = (startedAt: unknown, now: number = Date.now()): boolean => typeof startedAt === "number" && Number.isFinite(startedAt) && now - startedAt < MIN_FILL_MS;

/** Limite por IP (melhor esforço). Devolve true se DEVE bloquear. */
export function isIpRateLimited(ip: string | null, now: number = Date.now()): boolean {
  if (!ip) return false;
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Evita crescer sem limite em instâncias longas.
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

export const isTurnstileConfigured = (): boolean => Boolean(process.env.TURNSTILE_SECRET_KEY);

/** Valida o token do Turnstile. Sem chave configurada, não bloqueia (etapa de desenvolvimento). */
export async function verifyTurnstile(token: unknown, ip: string | null): Promise<{ ok: boolean; skipped: boolean }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) return { ok: false, skipped: false };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const json = (await res.json()) as { success?: boolean };
    return { ok: json.success === true, skipped: false };
  } catch {
    // Falha ao consultar o Cloudflare: por segurança, não deixa passar.
    return { ok: false, skipped: false };
  }
}

/** Só para testes. */
export const __resetRateLimit = () => hits.clear();
