import { headers } from "next/headers";

/**
 * Página de onde a ação foi disparada (cabeçalho Referer), só se for dentro do painel.
 * Serve para devolver a pessoa ao mesmo lugar com um recado, sem precisar levar a URL em cada formulário.
 */
export async function refererPath(fallback: string): Promise<string> {
  const ref = (await headers()).get("referer");
  if (!ref) return fallback;
  try {
    const url = new URL(ref);
    const path = `${url.pathname}${url.search}`;
    return path.startsWith("/admin/") ? path : fallback;
  } catch {
    return fallback;
  }
}
