import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { as, freshDb } from "./harness.mjs";

let db;
const msg = async (p) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e.message;
  }
};

const submit = (o = {}) => {
  const a = { name: "Lead Teste Silva", phone: "00900001001", source: "instagram", detail: "reels-teste", area: "facial_olhar", goal: "manchas", complaint: "Manchas no rosto", desired: "Uniformizar", answers: { duration: "months" }, consent: true, ...o };
  return as(db, "anon", null, () =>
    db.query("select public.submit_screening($1,$2,null,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) id", [a.name, a.phone, a.source, a.detail, a.area, a.goal, a.complaint, a.desired, JSON.stringify(a.answers), a.consent]),
  );
};

before(async () => {
  db = await freshDb({ seed: true });
});

describe("trava do termo de consentimento", () => {
  test("produção (padrão): sem termo ATIVO a triagem não coleta nada", async () => {
    const r = await db.query("select screening_requires_consent_term as v from settings");
    assert.equal(r.rows[0].v, true, "o padrão do banco é a trava LIGADA");
    assert.match(await msg(submit()), /consent_term_missing/);
    assert.equal((await db.query("select count(*)::int n from screenings")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from clients")).rows[0].n, 0, "nem cria cliente");
  });

  test("um termo em rascunho (inativo) não libera a coleta", async () => {
    await db.query("insert into consent_terms (version, body, active) values ('rascunho', '[texto ainda não oficial]', false)");
    assert.match(await msg(submit()), /consent_term_missing/);
  });

  test("com termo ATIVO a triagem funciona e guarda a versão aceita", async () => {
    await db.query("insert into consent_terms (version, body, active) values ('v1-teste', '[texto de teste]', true)");
    const id = (await submit()).rows[0].id;
    const s = (await db.query("select s.source, s.source_detail, s.interest_area, s.goal, s.answers, s.status, t.version from screenings s join consent_terms t on t.id = s.consent_term_id where s.id = $1", [id])).rows[0];
    assert.deepEqual([s.source, s.source_detail, s.interest_area, s.goal, s.status, s.version], ["instagram", "reels-teste", "facial_olhar", "manchas", "new", "v1-teste"]);
    assert.deepEqual(s.answers, { duration: "months" });
  });

  test("ambiente local/demo pode relaxar a trava (nunca é o padrão)", async () => {
    const d2 = await freshDb({ seed: true });
    await d2.query("update settings set screening_requires_consent_term = false");
    const r = await as(d2, "anon", null, () => d2.query("select public.submit_screening('Lead Local Dev','00900001002',null,'site',null,'facial_olhar','manchas','Queixa de teste',null,'{}'::jsonb,true) id"));
    assert.ok(r.rows[0].id);
  });
});

describe("dados da triagem só para admin", () => {
  test("anônimo não lê nenhuma triagem, nem a que acabou de enviar", async () => {
    await submit({ phone: "00900001003" });
    const rows = await as(db, "anon", null, () => db.query("select count(*)::int n from screenings"));
    assert.equal(rows.rows[0].n, 0);
  });

  test("origem inválida cai em 'other'; mais de 200 caracteres no detalhe é barrado", async () => {
    const id = (await submit({ phone: "00900001004", source: "tiktok??" })).rows[0].id;
    assert.equal((await db.query("select source from screenings where id = $1", [id])).rows[0].source, "other");
    assert.ok(await msg(submit({ phone: "00900001005", detail: "x".repeat(300) })), "detalhe enorme viola a restrição de tamanho");
  });

  test("limite por telefone continua valendo (3 em 24 h)", async () => {
    for (let i = 0; i < 3; i++) await submit({ phone: "00900001099" });
    assert.match(await msg(submit({ phone: "00900001099" })), /too_many/);
  });
});

describe("a agenda comanda o estado da triagem", () => {
  let screening;
  let client;

  before(async () => {
    screening = (await submit({ phone: "00900001010" })).rows[0].id;
    client = (await db.query("select client_id from screenings where id = $1", [screening])).rows[0].client_id;
  });

  const evaluation = (day, status = "pending", screeningId = screening) =>
    db.query(
      "insert into appointments (client_id, screening_id, kind, starts_at, ends_at, status) values ($1, $2, 'evaluation', now() + ($3 || ' days')::interval, now() + ($3 || ' days')::interval + interval '1 hour', $4) returning id",
      [client, screeningId, String(day), status],
    );
  const status = async () => (await db.query("select status from screenings where id = $1", [screening])).rows[0].status;

  test("avaliação CANCELADA criada não muda o estado", async () => {
    await evaluation(40, "cancelled");
    assert.equal(await status(), "new");
  });

  test("agendar avaliação ligada à triagem → 'avaliação agendada'", async () => {
    const appt = (await evaluation(41)).rows[0].id;
    assert.equal(await status(), "evaluation_scheduled");
    // concluir a avaliação → 'avaliada'
    await db.query("update appointments set status = 'completed' where id = $1", [appt]);
    assert.equal(await status(), "evaluated");
  });

  test("não retrocede: com tratamento proposto, agendar outra avaliação não altera o estado", async () => {
    await db.query("update screenings set status = 'treatment_proposed' where id = $1", [screening]);
    await evaluation(42);
    assert.equal(await status(), "treatment_proposed");
  });

  test("avaliação sem triagem vinculada não mexe em nenhuma triagem", async () => {
    const other = (await submit({ phone: "00900001011" })).rows[0].id;
    await evaluation(43, "pending", null);
    assert.equal((await db.query("select status from screenings where id = $1", [other])).rows[0].status, "new");
  });
});
