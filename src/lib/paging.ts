// Arquivo PURO (sem imports com alias): roda nos testes unitários.

/**
 * Junta todas as páginas de uma consulta. O Supabase corta a resposta em 1000 linhas por padrão e não
 * avisa: sem isto, uma lista grande simplesmente perderia registros. `fetchPage(from, to)` recebe os
 * índices inclusivos da página (o mesmo formato do `.range()` do supabase-js).
 */
export async function fetchAllPages<T>(fetchPage: (from: number, to: number) => Promise<T[]>, pageSize = 1000, maxPages = 200): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const rows = await fetchPage(page * pageSize, page * pageSize + pageSize - 1);
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
  throw new Error(`A consulta passou de ${maxPages * pageSize} linhas: use um filtro.`);
}
