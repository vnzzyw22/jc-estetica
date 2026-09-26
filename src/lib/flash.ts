// Recados que voltam pela URL (`?erro=` e `?aviso=`) depois de uma ação do painel. Sem "use server":
// são funções puras, usadas pelas ações.

/** Só volta para dentro do painel; qualquer outra coisa cai no padrão (evita redirecionamento aberto). */
export function backTo(raw: string, fallback: string): string {
  return raw.startsWith("/admin/") && !raw.startsWith("//") ? raw : fallback;
}

/** Devolve a URL com um recado; `drop` remove outros parâmetros (ex.: o formulário que estava aberto). */
export function withParam(url: string, key: "erro" | "aviso", value: string, drop: string[] = []): string {
  const u = new URL(url, "http://local");
  for (const k of ["erro", "aviso", ...drop]) u.searchParams.delete(k);
  u.searchParams.set(key, value);
  return `${u.pathname}${u.search}${u.hash}`;
}
