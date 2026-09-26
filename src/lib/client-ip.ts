import { headers } from "next/headers";

/** IP de quem chamou a ação (melhor esforço: atrás de proxy vem em x-forwarded-for). Só servidor. */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip")) || null;
}
