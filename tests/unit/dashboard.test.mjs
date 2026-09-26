import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { attentionItems, partitionByDay } from "../../src/lib/dashboard.ts";

const none = { newScreenings: 0, pendingAppointments: 0, sessionsToClose: 0, activeWithoutNext: 0, overdueReceivable: { count: 0, total: 0 }, overdueExpense: { count: 0, total: 0 } };

describe("attentionItems", () => {
  test("tudo em dia: lista vazia", () => {
    assert.deepEqual(attentionItems(none), []);
  });

  test("só entra o que é maior que zero", () => {
    const items = attentionItems({ ...none, newScreenings: 2 });
    assert.deepEqual(items.map((i) => i.key), ["triagens"]);
  });

  test("ordem: dinheiro a receber atrasado, sessões, triagens, confirmações, sem sessão, despesas", () => {
    const items = attentionItems({ newScreenings: 1, pendingAppointments: 1, sessionsToClose: 1, activeWithoutNext: 1, overdueReceivable: { count: 1, total: 10 }, overdueExpense: { count: 1, total: 5 } });
    assert.deepEqual(items.map((i) => i.key), ["receber", "sessoes", "triagens", "confirmar", "sem-sessao", "despesas"]);
  });

  test("singular e plural concordam", () => {
    const one = attentionItems({ ...none, newScreenings: 1, pendingAppointments: 1, sessionsToClose: 1, activeWithoutNext: 1, overdueReceivable: { count: 1, total: 1 }, overdueExpense: { count: 1, total: 1 } }).map((i) => i.text);
    assert.deepEqual(one, [
      "1 recebimento atrasado",
      "1 sessão passou sem ser marcada como realizada",
      "1 triagem nova esperando retorno",
      "1 agendamento aguardando confirmação",
      "1 tratamento em andamento sem sessão marcada",
      "1 despesa atrasada",
    ]);
    const many = attentionItems({ ...none, newScreenings: 3, pendingAppointments: 2, sessionsToClose: 4, activeWithoutNext: 2, overdueReceivable: { count: 2, total: 1 }, overdueExpense: { count: 3, total: 1 } }).map((i) => i.text);
    assert.deepEqual(many, [
      "2 recebimentos atrasados",
      "4 sessões passaram sem serem marcadas como realizadas",
      "3 triagens novas esperando retorno",
      "2 agendamentos aguardando confirmação",
      "2 tratamentos em andamento sem sessão marcada",
      "3 despesas atrasadas",
    ]);
  });

  test("dinheiro carrega o valor; o resto não", () => {
    const items = attentionItems({ ...none, newScreenings: 1, overdueReceivable: { count: 2, total: 450.5 }, overdueExpense: { count: 1, total: 89.9 } });
    const by = Object.fromEntries(items.map((i) => [i.key, i]));
    assert.equal(by.receber.amount, 450.5);
    assert.equal(by.despesas.amount, 89.9);
    assert.equal(by.triagens.amount, undefined);
  });

  test("atraso é 'late'; pendência de ação é 'todo'; todo link fica dentro do painel", () => {
    const items = attentionItems({ newScreenings: 1, pendingAppointments: 1, sessionsToClose: 1, activeWithoutNext: 1, overdueReceivable: { count: 1, total: 1 }, overdueExpense: { count: 1, total: 1 } });
    const tone = Object.fromEntries(items.map((i) => [i.key, i.tone]));
    assert.deepEqual(tone, { receber: "late", sessoes: "late", triagens: "todo", confirmar: "todo", "sem-sessao": "todo", despesas: "late" });
    assert.ok(items.every((i) => i.href.startsWith("/admin/")));
  });
});

describe("partitionByDay", () => {
  const rows = ["2026-09-25", "2026-09-26", "2026-09-26", "2026-09-27", "2026-10-10", "2026-10-11"];
  const day = (r) => r;

  test("hoje separado do que vem depois; passado e além do limite ficam de fora", () => {
    const p = partitionByDay(rows, day, "2026-09-26", "2026-10-10");
    assert.deepEqual(p.today, ["2026-09-26", "2026-09-26"]);
    assert.deepEqual(p.later, ["2026-09-27", "2026-10-10"]);
  });

  test("limite inclusivo e ordem preservada", () => {
    assert.deepEqual(partitionByDay(["2026-09-28", "2026-09-27"], day, "2026-09-26", "2026-09-28").later, ["2026-09-28", "2026-09-27"]);
  });

  test("sem linhas", () => {
    assert.deepEqual(partitionByDay([], day, "2026-09-26", "2026-10-10"), { today: [], later: [] });
  });
});
