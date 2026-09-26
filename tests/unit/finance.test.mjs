import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addMonths, csvLine, daysLate, groupByDay, queryString, installmentLabel, isMonth, monthRange, monthSeries, overdueRows, parseMoney, paymentView, periodTotals, splitInstallments, sumBy, sumMoney, totalsOf } from "../../src/lib/finance.ts";

const row = (o) => ({ direction: "in", occurred_on: "2026-09-10", amount: 100, state: "realized", source: "payment", source_id: "x", client_id: null, treatment_id: null, category: "other", description: null, method: null, category_name: null, ...o });

describe("parseMoney", () => {
  test("formatos brasileiros e simples", () => {
    assert.equal(parseMoney("120"), 120);
    assert.equal(parseMoney("120,5"), 120.5);
    assert.equal(parseMoney("1234,56"), 1234.56);
    assert.equal(parseMoney("1.234,56"), 1234.56);
    assert.equal(parseMoney("1234.56"), 1234.56);
    assert.equal(parseMoney("R$ 89,90"), 89.9);
    assert.equal(parseMoney("1.234"), 1234, "ponto com 3 dígitos é milhar, não decimal");
    assert.equal(parseMoney("12.5"), 12.5);
  });
  test("lixo vira null (nunca NaN)", () => {
    for (const bad of ["", "  ", "abc", "12,34,56", "--5", "1,2,3", null, undefined]) assert.equal(parseMoney(bad), null, String(bad));
  });
  test("arredonda em 2 casas", () => {
    assert.equal(parseMoney("10,999"), 11);
    assert.equal(parseMoney("0,1"), 0.1);
  });
});

describe("meses", () => {
  test("isMonth", () => {
    assert.equal(isMonth("2026-09"), true);
    assert.equal(isMonth("2026-13"), false);
    assert.equal(isMonth("2026-9"), false);
    assert.equal(isMonth(undefined), false);
  });
  test("addMonths atravessa o ano", () => {
    assert.equal(addMonths("2026-11", 3), "2027-02");
    assert.equal(addMonths("2026-02", -3), "2025-11");
  });
  test("monthRange respeita fevereiro e o limite exclusivo", () => {
    assert.deepEqual(monthRange("2026-02"), { first: "2026-02-01", last: "2026-02-28", next: "2026-03-01" });
    assert.deepEqual(monthRange("2028-02"), { first: "2028-02-01", last: "2028-02-29", next: "2028-03-01" });
    assert.equal(monthRange("2026-12").next, "2027-01-01");
  });
});

describe("totais em centavos", () => {
  test("0,10 + 0,20 fecha em 0,30 exato", () => {
    const t = totalsOf([row({ amount: 0.1 }), row({ amount: 0.2 })]);
    assert.equal(t.received, 0.3);
  });

  test("separa recebido, a receber, pago e a pagar; resultado e previsão", () => {
    const t = totalsOf([
      row({ amount: 500 }),
      row({ amount: 300, state: "expected" }),
      row({ amount: 200, direction: "out" }),
      row({ amount: 120, direction: "out", state: "expected" }),
    ]);
    assert.deepEqual(t, { received: 500, toReceive: 300, paid: 200, toPay: 120, result: 300, forecast: 480 });
  });

  test("resultado negativo é preservado", () => {
    assert.equal(totalsOf([row({ amount: 50 }), row({ amount: 200, direction: "out" })]).result, -150);
  });

  test("periodTotals usa limites inclusivos", () => {
    const rows = [row({ occurred_on: "2026-09-01", amount: 10 }), row({ occurred_on: "2026-09-30", amount: 20 }), row({ occurred_on: "2026-10-01", amount: 40 }), row({ occurred_on: "2026-08-31", amount: 80 })];
    assert.equal(periodTotals(rows, "2026-09-01", "2026-09-30").received, 30);
  });
});

describe("monthSeries", () => {
  test("devolve N meses em ordem, inclusive os vazios", () => {
    const s = monthSeries([row({ occurred_on: "2026-09-10", amount: 100 }), row({ occurred_on: "2026-07-02", amount: 40 })], "2026-09", 4);
    assert.deepEqual(s.map((p) => p.month), ["2026-06", "2026-07", "2026-08", "2026-09"]);
    assert.deepEqual(s.map((p) => p.received), [0, 40, 0, 100]);
  });
});

describe("sumBy", () => {
  test("agrupa, soma e ordena do maior para o menor", () => {
    const rows = [row({ direction: "out", category_name: "Aluguel", amount: 850 }), row({ direction: "out", category_name: "Insumos", amount: 100 }), row({ direction: "out", category_name: "Insumos", amount: 50.5 })];
    const s = sumBy(rows, (r) => r.category_name);
    assert.deepEqual(s, [{ key: "Aluguel", total: 850, count: 1 }, { key: "Insumos", total: 150.5, count: 2 }]);
  });
  test("empate de valor: ordem alfabética estável", () => {
    const s = sumBy([row({ amount: 10, method: "pix" }), row({ amount: 10, method: "cash" })], (r) => r.method);
    assert.deepEqual(s.map((x) => x.key), ["cash", "pix"]);
  });
});

describe("atrasos", () => {
  const rows = [
    row({ state: "expected", occurred_on: "2026-09-01", amount: 10 }),
    row({ state: "expected", occurred_on: "2026-09-25", amount: 20 }), // hoje: NÃO é atraso
    row({ state: "expected", occurred_on: "2026-09-30", amount: 30 }),
    row({ state: "realized", occurred_on: "2026-08-01", amount: 40 }),
    row({ state: "expected", occurred_on: "2026-09-02", amount: 50, direction: "out" }),
  ];
  test("só previsto e anterior a hoje, na direção pedida, do mais antigo ao mais novo", () => {
    assert.deepEqual(overdueRows(rows, "2026-09-25", "in").map((r) => r.amount), [10]);
    assert.deepEqual(overdueRows(rows, "2026-09-25", "out").map((r) => r.amount), [50]);
  });
  test("paymentView: pendente vencido é 'overdue'; vence hoje ainda não", () => {
    assert.equal(paymentView({ status: "pending", due_date: "2026-09-24" }, "2026-09-25"), "overdue");
    assert.equal(paymentView({ status: "pending", due_date: "2026-09-25" }, "2026-09-25"), "pending");
    assert.equal(paymentView({ status: "paid", due_date: "2020-01-01" }, "2026-09-25"), "paid");
    assert.equal(paymentView({ status: "cancelled", due_date: "2020-01-01" }, "2026-09-25"), "cancelled");
  });
  test("daysLate", () => {
    assert.equal(daysLate("2026-09-20", "2026-09-25"), 5);
    assert.equal(daysLate("2026-09-25", "2026-09-25"), 0);
    assert.equal(daysLate("2026-09-30", "2026-09-25"), 0);
  });
});

describe("parcelas", () => {
  test("a soma fecha exatamente e a última absorve os centavos", () => {
    assert.deepEqual(splitInstallments(100, 3), [33.33, 33.33, 33.34]);
    assert.deepEqual(splitInstallments(900, 4), [225, 225, 225, 225]);
    assert.equal(Math.round(splitInstallments(1000.01, 7).reduce((s, v) => s + v, 0) * 100), 100001);
  });
  test("rótulo só aparece com mais de uma parcela", () => {
    assert.equal(installmentLabel({ installment_number: 2, installment_total: 4 }), "2/4");
    assert.equal(installmentLabel({ installment_number: 1, installment_total: 1 }), "");
  });
});

describe("csvLine", () => {
  test("separador ';', vírgula decimal, aspas quando preciso", () => {
    assert.equal(csvLine(["a", 12.5, null, "x;y", 'diz "oi"']), 'a;12,50;;"x;y";"diz ""oi"""');
  });
  test("texto que começa como fórmula é neutralizado; número negativo não", () => {
    assert.equal(csvLine(["=SOMA(A1)"]), "'=SOMA(A1)");
    assert.equal(csvLine([-5]), "-5,00");
  });
});

describe("groupByDay", () => {
  test("dia mais recente primeiro; dentro do dia, realizado antes do previsto", () => {
    const g = groupByDay([
      row({ occurred_on: "2026-09-02", amount: 1 }),
      row({ occurred_on: "2026-09-10", amount: 2, state: "expected" }),
      row({ occurred_on: "2026-09-10", amount: 3 }),
      row({ occurred_on: "2026-09-05", amount: 4 }),
    ]);
    assert.deepEqual(g.map((d) => d.date), ["2026-09-10", "2026-09-05", "2026-09-02"]);
    assert.deepEqual(g[0].rows.map((r) => r.amount), [3, 2]);
  });
  test("sem movimento, sem grupos", () => {
    assert.deepEqual(groupByDay([]), []);
  });
});

describe("queryString", () => {
  test("só entra o que tem valor; sem nada, devolve vazio", () => {
    assert.equal(queryString({ mes: "2026-09", filtro: "", x: null, y: undefined }), "?mes=2026-09");
    assert.equal(queryString({}), "");
  });
  test("escapa caracteres especiais", () => {
    assert.equal(queryString({ q: "a b&c" }), "?q=a+b%26c");
  });
});

describe("sumMoney", () => {
  test("soma em centavos: 0,1 + 0,2 = 0,3", () => {
    assert.equal(sumMoney([0.1, 0.2]), 0.3);
    assert.equal(sumMoney([]), 0);
    assert.equal(sumMoney([33.33, 33.33, 33.34]), 100);
  });
});
