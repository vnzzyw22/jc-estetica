import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { before, describe, test } from "node:test";
import { freshDb } from "./harness.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const demo = readFileSync(join(ROOT, "supabase/demo/seed-demo.sql"), "utf8");
const clear = readFileSync(join(ROOT, "supabase/demo/clear-demo.sql"), "utf8");
let db;

before(async () => {
  db = await freshDb({ seed: true });
  await db.exec(demo);
});

const one = async (sql) => (await db.query(sql)).rows[0];

describe("dados demonstrativos", () => {
  test("todos os clientes são claramente fictícios: telefone inválido (009…) e marcados", async () => {
    const r = await one("select count(*)::int total, count(*) filter (where phone like '009%')::int demo, count(*) filter (where notes = 'Dado demonstrativo.')::int marcados from clients");
    assert.equal(r.total, 8);
    assert.equal(r.demo, 8);
    assert.equal(r.marcados, 8);
  });

  test("nada de placeholders genéricos", async () => {
    const r = await one("select count(*)::int n from clients where name ~* '(john|doe|lorem|service|example treatment)'");
    assert.equal(r.n, 0);
    assert.doesNotMatch(demo, /lorem|john doe|R\$ ?0,00/i);
  });

  test("triagens cobrem todos os estágios usados no CRM", async () => {
    const r = (await db.query("select distinct status from screenings order by 1")).rows.map((x) => x.status);
    for (const s of ["new", "in_review", "evaluation_scheduled", "treatment_proposed", "treatment_active", "closed"]) assert.ok(r.includes(s), s);
  });

  test("tratamento facial: 6/8 feitas, 7ª hoje, 8ª a agendar; progresso confere", async () => {
    const p = await one("select p.completed, p.total_sessions, p.scheduled, p.unscheduled from treatment_progress p join treatments t on t.id = p.treatment_id where t.name = 'Protocolo de Rejuvenescimento Facial'");
    assert.deepEqual([p.completed, p.total_sessions, p.scheduled, p.unscheduled], [6, 8, 1, 1]);
  });

  test("parcelas do pacote somam exatamente o valor e ficam vinculadas ao tratamento e à cliente", async () => {
    const r = await one("select sum(p.amount)::float8 soma, t.price_total::float8 total, bool_and(p.client_id = t.client_id) ok from payments p join treatments t on t.id = p.treatment_id where t.name = 'Protocolo de Rejuvenescimento Facial' group by t.price_total");
    assert.equal(r.soma, r.total);
    assert.equal(r.ok, true);
  });

  test("agenda de hoje tem sessões e avaliação; sessões realizadas geraram evolução", async () => {
    const hoje = await one("select count(*)::int n from appointments where (starts_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date and status <> 'cancelled'");
    assert.ok(hoje.n >= 3);
    assert.ok((await one("select count(*)::int n from evolutions")).n >= 2);
  });

  test("financeiro tem entradas e saídas, realizadas e previstas", async () => {
    const r = (await db.query("select direction, state, sum(amount)::float8 total from cash_flow group by 1, 2 order by 1, 2")).rows.map((x) => `${x.direction}/${x.state}`);
    for (const k of ["in/realized", "in/expected", "out/realized"]) assert.ok(r.includes(k), k);
  });

  test("carregar duas vezes não duplica", async () => {
    await db.exec(demo);
    assert.equal((await one("select count(*)::int n from clients")).n, 8);
  });

  test("clear-demo remove tudo do demo e preserva o catálogo e clientes reais", async () => {
    await db.query("insert into clients (name, phone) values ('Cliente Real Simulada', '44988887777')");
    await db.exec(clear);
    assert.equal((await one("select count(*)::int n from clients where phone like '009%'")).n, 0);
    assert.equal((await one("select count(*)::int n from clients where phone = '44988887777'")).n, 1);
    for (const t of ["screenings", "treatments", "payments", "expenses", "treatment_packages", "appointments"]) {
      assert.equal((await one(`select count(*)::int n from ${t}`)).n, 0, t);
    }
    assert.equal((await one("select count(*)::int n from services")).n, 12);
  });
});
