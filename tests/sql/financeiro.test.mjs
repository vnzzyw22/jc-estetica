import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { as, freshDb } from "./harness.mjs";

const ADMIN = "11111111-1111-1111-1111-111111111111";
const STRANGER = "22222222-2222-2222-2222-222222222222";

const msg = async (promise) => {
  try {
    await promise;
    return null;
  } catch (e) {
    return e.message;
  }
};
const code = async (promise) => {
  try {
    await promise;
    return null;
  } catch (e) {
    return e.code ?? e.message;
  }
};

let db;
let clientA;
let clientB;
let treatmentA;
let apptA;
let catFixed;
let catVariable;

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

before(async () => {
  db = await freshDb({ seed: true });
  await db.query("insert into auth.users (id, email) values ($1, 'admin@x'), ($2, 'stranger@x')", [ADMIN, STRANGER]);
  await db.query("insert into admin_profiles (user_id) values ($1)", [ADMIN]);
  clientA = (await one("insert into clients (name, phone) values ('Cliente A Demo', '00900000101') returning id")).id;
  clientB = (await one("insert into clients (name, phone) values ('Cliente B Demo', '00900000102') returning id")).id;
  treatmentA = (await one("insert into treatments (client_id, name, total_sessions, price_total) values ($1, 'Protocolo Demo', 4, 900) returning id", [clientA])).id;
  const service = (await one("select id from services order by display_order limit 1")).id;
  apptA = (await one("insert into appointments (client_id, service_id, kind, starts_at, ends_at) values ($1, $2, 'service', now() + interval '10 days', now() + interval '10 days 1 hour') returning id", [clientA, service])).id;
  catFixed = (await one("select id from expense_categories where kind = 'fixed' order by name limit 1")).id;
  catVariable = (await one("select id from expense_categories where kind = 'variable' order by name limit 1")).id;
});

describe("cash_flow", () => {
  test("mantém as colunas antigas na mesma ordem e acrescenta descrição, forma e categoria no fim", async () => {
    const cols = (await db.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'cash_flow' order by ordinal_position")).rows.map((r) => r.column_name);
    assert.deepEqual(cols, ["direction", "occurred_on", "amount", "state", "source", "source_id", "client_id", "treatment_id", "category", "description", "method", "category_name"]);
  });

  test("despesa traz o nome da categoria; recebimento traz a forma de pagamento", async () => {
    await db.query("insert into expenses (category_id, description, amount, paid_at) values ($1, 'Despesa fluxo demo', 80, now())", [catFixed]);
    await db.query("insert into payments (kind, description, amount, method, status, paid_at) values ('other', 'Recebimento fluxo demo', 30, 'pix', 'paid', now())");
    const out = await one("select category_name, category, description from cash_flow where description = 'Despesa fluxo demo'");
    assert.ok(out.category_name);
    assert.equal(out.category, "fixed");
    const inn = await one("select method, category_name from cash_flow where description = 'Recebimento fluxo demo'");
    assert.deepEqual([inn.method, inn.category_name], ["pix", null]);
  });
});

describe("create_receivable", () => {
  test("à vista, avulso: vira 'other', pendente, com a data de vencimento pedida", async () => {
    assert.equal((await one("select public.create_receivable(null, 'Venda de produto demo', 145.50, 1, '2026-10-05', 'pix') n")).n, 1);
    const p = await one("select kind, status, amount::float8 a, due_date::text d, method, client_id, installment_number n, installment_total t from payments where description = 'Venda de produto demo'");
    assert.deepEqual([p.kind, p.status, p.a, p.d, p.method, p.client_id, p.n, p.t], ["other", "pending", 145.5, "2026-10-05", "pix", null, 1, 1]);
  });

  test("parcelado: as parcelas somam exatamente o total (centavos na última) e vencem mês a mês", async () => {
    await db.query("select public.create_receivable($1, 'Parcelado demo', 100, 3, '2026-01-31', 'credit')", [clientA]);
    const rows = (await db.query("select amount::float8 a, due_date::text d, installment_number n from payments where description = 'Parcelado demo' order by installment_number")).rows;
    assert.deepEqual(rows.map((r) => r.a), [33.33, 33.33, 33.34]);
    assert.equal(Math.round(rows.reduce((s, r) => s + r.a, 0) * 100), 10000);
    assert.deepEqual(rows.map((r) => r.d), ["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  test("com tratamento: herda a cliente e vira 'treatment'; descrição padrão = nome do tratamento", async () => {
    await db.query("select public.create_receivable(null, null, 300, 1, current_date, 'cash', $1)", [treatmentA]);
    const p = await one("select kind, client_id, treatment_id, description from payments where treatment_id = $1 and amount = 300", [treatmentA]);
    assert.deepEqual([p.kind, p.client_id, p.treatment_id, p.description], ["treatment", clientA, treatmentA, "Protocolo Demo"]);
  });

  test("com atendimento: vira 'service' e guarda o vínculo", async () => {
    await db.query("select public.create_receivable($1, 'Atendimento demo', 120, 1, current_date, 'debit', null, $2)", [clientA, apptA]);
    const p = await one("select kind, appointment_id from payments where description = 'Atendimento demo'");
    assert.deepEqual([p.kind, p.appointment_id], ["service", apptA]);
  });

  test("já recebido: só vale para pagamento único; entra como entrada REALIZADA", async () => {
    await db.query("select public.create_receivable($1, 'Recebido na hora demo', 60, 1, current_date, 'pix', null, null, now())", [clientB]);
    const p = await one("select status, paid_at is not null as pago from payments where description = 'Recebido na hora demo'");
    assert.deepEqual([p.status, p.pago], ["paid", true]);
    assert.equal((await one("select state from cash_flow where description = 'Recebido na hora demo'")).state, "realized");
    assert.match(await msg(db.query("select public.create_receivable($1, 'x', 60, 2, current_date, 'pix', null, null, now())", [clientB])), /paid_needs_single/);
    assert.match(await msg(db.query("select public.create_receivable($1, 'x', 60, 1, current_date, 'pix', null, null, now() + interval '30 days')", [clientB])), /paid_in_future/);
  });

  test("recusa entradas inválidas", async () => {
    assert.match(await msg(db.query("select public.create_receivable($1, 'x', 0)", [clientA])), /invalid_amount/);
    assert.match(await msg(db.query("select public.create_receivable($1, 'x', -5)", [clientA])), /invalid_amount/);
    assert.match(await msg(db.query("select public.create_receivable($1, 'x', 10, 0)", [clientA])), /invalid_installments/);
    assert.match(await msg(db.query("select public.create_receivable($1, 'x', 10, 37)", [clientA])), /invalid_installments/);
    assert.match(await msg(db.query("select public.create_receivable(null, null, 10)")), /description_required/);
    assert.match(await msg(db.query("select public.create_receivable($1, 'x', 10, 1, current_date, 'pix', $2)", [clientB, treatmentA])), /client_mismatch/);
    assert.match(await msg(db.query("select public.create_receivable($1, 'x', 10, 1, current_date, 'pix', null, $2)", [clientB, apptA])), /client_mismatch/);
    assert.match(await msg(db.query("select public.create_receivable('00000000-0000-0000-0000-000000000000', 'x', 10)")), /client_not_found/);
    assert.match(await msg(db.query("select public.create_receivable($1, 'x', 10, 1, current_date, 'boleto')", [clientA])), /payments_method_check|violates check/);
  });

  test("uma recusa não deixa parcelas pela metade", async () => {
    const before = (await one("select count(*)::int n from payments")).n;
    await msg(db.query("select public.create_receivable($1, 'Meio', 90, 3, current_date, 'boleto')", [clientA]));
    assert.equal((await one("select count(*)::int n from payments")).n, before);
  });
});

describe("change_payment_status", () => {
  let id;
  before(async () => {
    await db.query("select public.create_receivable($1, 'Ciclo de status demo', 200, 1, current_date, null)", [clientA]);
    id = (await one("select id from payments where description = 'Ciclo de status demo'")).id;
  });

  test("receber exige a forma de pagamento; com ela, marca pago com data", async () => {
    assert.match(await msg(db.query("select public.change_payment_status($1, 'paid')", [id])), /method_required/);
    await db.query("select public.change_payment_status($1, 'paid', '2026-09-20T15:00:00-03:00', 'pix')", [id]);
    const p = await one("select status, method, (paid_at at time zone 'America/Sao_Paulo')::date::text d from payments where id = $1", [id]);
    assert.deepEqual([p.status, p.method, p.d], ["paid", "pix", "2026-09-20"]);
    const flow = await one("select state, occurred_on::text d from cash_flow where source_id = $1", [id]);
    assert.deepEqual([flow.state, flow.d], ["realized", "2026-09-20"]);
  });

  test("receber de novo, ou cancelar um pago, é recusado", async () => {
    assert.match(await msg(db.query("select public.change_payment_status($1, 'paid', null, 'pix')", [id])), /invalid_status/);
    assert.match(await msg(db.query("select public.change_payment_status($1, 'cancelled')", [id])), /invalid_status/);
  });

  test("desfazer volta a pendente e limpa a data; sai do realizado", async () => {
    await db.query("select public.change_payment_status($1, 'pending')", [id]);
    const p = await one("select status, paid_at from payments where id = $1", [id]);
    assert.deepEqual([p.status, p.paid_at], ["pending", null]);
    assert.equal((await one("select state from cash_flow where source_id = $1", [id])).state, "expected");
  });

  test("cancelar tira o valor do caixa; restaurar devolve como pendente", async () => {
    await db.query("select public.change_payment_status($1, 'cancelled')", [id]);
    assert.equal((await one("select count(*)::int n from cash_flow where source_id = $1", [id])).n, 0);
    await db.query("select public.change_payment_status($1, 'pending')", [id]);
    assert.equal((await one("select count(*)::int n from cash_flow where source_id = $1", [id])).n, 1);
  });

  test("estado desconhecido ou recebimento inexistente", async () => {
    assert.match(await msg(db.query("select public.change_payment_status($1, 'refunded')", [id])), /invalid_status/);
    assert.match(await msg(db.query("select public.change_payment_status('00000000-0000-0000-0000-000000000000', 'paid', null, 'pix')")), /payment_not_found/);
  });
});

describe("generate_recurring_expenses", () => {
  before(async () => {
    await db.query("insert into expenses (category_id, description, amount, incurred_on, paid_at, is_recurring) values ($1, 'Aluguel recorrente demo', 800, '2026-01-31', now(), true)", [catFixed]);
    await db.query("insert into expenses (category_id, description, amount, incurred_on, paid_at, is_recurring) values ($1, 'Aluguel recorrente demo', 850, '2026-02-28', now(), true)", [catFixed]);
    await db.query("insert into expenses (category_id, description, amount, incurred_on, paid_at, is_recurring) values ($1, 'Compra avulsa demo', 40, '2026-02-10', now(), false)", [catVariable]);
  });

  test("copia a ocorrência MAIS RECENTE (valor atualizado), a pagar, e ignora o que não é recorrente", async () => {
    assert.equal((await one("select public.generate_recurring_expenses('2026-03-15') n")).n, 1);
    const e = await one("select amount::float8 a, incurred_on::text d, paid_at, is_recurring from expenses where description = 'Aluguel recorrente demo' and incurred_on >= '2026-03-01'");
    assert.deepEqual([e.a, e.d, e.paid_at, e.is_recurring], [850, "2026-03-28", null, true]);
    assert.equal((await one("select count(*)::int n from expenses where description = 'Compra avulsa demo'")).n, 1);
  });

  test("é idempotente: rodar de novo no mesmo mês não duplica", async () => {
    assert.equal((await one("select public.generate_recurring_expenses('2026-03-01') n")).n, 0);
    assert.equal((await one("select count(*)::int n from expenses where description = 'Aluguel recorrente demo' and incurred_on between '2026-03-01' and '2026-03-31'")).n, 1);
  });

  test("dia 31 num mês curto cai no último dia do mês", async () => {
    await db.query("insert into expenses (category_id, description, amount, incurred_on, paid_at, is_recurring) values ($1, 'Assinatura dia 31 demo', 20, '2026-01-31', now(), true)", [catFixed]);
    await db.query("select public.generate_recurring_expenses('2026-02-10')");
    assert.equal((await one("select incurred_on::text d from expenses where description = 'Assinatura dia 31 demo' and incurred_on >= '2026-02-01'")).d, "2026-02-28");
  });
});

describe("permissões", () => {
  test("visitante (anon) não executa as funções financeiras nem lê o caixa", async () => {
    assert.equal(await as(db, "anon", null, () => code(db.query("select public.create_receivable(null, 'x', 10)"))), "42501");
    assert.equal(await as(db, "anon", null, () => code(db.query("select public.change_payment_status('00000000-0000-0000-0000-000000000000', 'pending')"))), "42501");
    assert.equal(await as(db, "anon", null, () => code(db.query("select public.generate_recurring_expenses(current_date)"))), "42501");
    assert.equal((await as(db, "anon", null, () => db.query("select count(*)::int n from cash_flow"))).rows[0].n, 0);
  });

  test("usuária autenticada que NÃO é admin é barrada pela RLS", async () => {
    const created = await as(db, "authenticated", STRANGER, () => code(db.query("select public.create_receivable(null, 'x', 10)")));
    assert.equal(created, "42501");
    assert.equal((await as(db, "authenticated", STRANGER, () => db.query("select count(*)::int n from cash_flow"))).rows[0].n, 0);
  });

  test("admin cria e lê normalmente", async () => {
    await as(db, "authenticated", ADMIN, () => db.query("select public.create_receivable(null, 'Feito pela admin demo', 10)"));
    const n = await as(db, "authenticated", ADMIN, () => db.query("select count(*)::int n from cash_flow where description = 'Feito pela admin demo'"));
    assert.equal(n.rows[0].n, 1);
  });
});
