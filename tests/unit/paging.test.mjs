import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fetchAllPages } from "../../src/lib/paging.ts";

/** Um "banco" de N linhas que responde como o supabase-js: no máximo `cap` por chamada, com range inclusivo. */
const fake = (total, cap = 1000) => {
  const calls = [];
  const fetchPage = async (from, to) => {
    calls.push([from, to]);
    const end = Math.min(to, from + cap - 1, total - 1);
    return end < from ? [] : Array.from({ length: end - from + 1 }, (_, i) => from + i);
  };
  return { fetchPage, calls };
};

describe("fetchAllPages", () => {
  test("lista pequena: uma chamada só", async () => {
    const { fetchPage, calls } = fake(37);
    const rows = await fetchAllPages(fetchPage, 1000);
    assert.equal(rows.length, 37);
    assert.equal(calls.length, 1);
  });

  test("lista vazia: devolve vazio", async () => {
    const { fetchPage } = fake(0);
    assert.deepEqual(await fetchAllPages(fetchPage, 1000), []);
  });

  test("mais de 1000 linhas: junta as páginas, sem perder nem repetir nenhuma", async () => {
    const { fetchPage, calls } = fake(2503);
    const rows = await fetchAllPages(fetchPage, 1000);
    assert.equal(rows.length, 2503);
    assert.deepEqual(rows, Array.from({ length: 2503 }, (_, i) => i));
    assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
  });

  test("exatamente um múltiplo do tamanho: pede a página seguinte e ela vem vazia", async () => {
    const { fetchPage, calls } = fake(2000);
    const rows = await fetchAllPages(fetchPage, 1000);
    assert.equal(rows.length, 2000);
    assert.equal(calls.length, 3);
  });

  test("tamanho de página menor que o limite do servidor", async () => {
    const { fetchPage } = fake(25);
    assert.equal((await fetchAllPages(fetchPage, 10)).length, 25);
  });

  test("um erro numa página propaga (nada de resultado parcial silencioso)", async () => {
    let n = 0;
    const boom = async () => {
      if (++n === 2) throw new Error("falhou");
      return Array.from({ length: 10 }, (_, i) => i);
    };
    await assert.rejects(() => fetchAllPages(boom, 10), /falhou/);
  });

  test("trava de segurança: consulta gigante falha alto em vez de rodar para sempre", async () => {
    const infinite = async () => Array.from({ length: 10 }, (_, i) => i);
    await assert.rejects(() => fetchAllPages(infinite, 10, 5), /use um filtro/);
  });
});
