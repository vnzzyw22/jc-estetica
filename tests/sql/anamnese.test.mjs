import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { as, freshDb } from "./harness.mjs";

const ADMIN = "11111111-1111-1111-1111-111111111111";
const STRANGER = "22222222-2222-2222-2222-222222222222";
let db;
let client;
let screening;

const code = async (p) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e.code ?? e.message;
  }
};

before(async () => {
  db = await freshDb({ seed: true });
  await db.query("insert into auth.users (id, email) values ($1, 'a@x'), ($2, 'b@x')", [ADMIN, STRANGER]);
  await db.query("insert into admin_profiles (user_id) values ($1)", [ADMIN]);
  client = (await db.query("insert into clients (name, phone) values ('Cliente Anamnese', '00900002001') returning id")).rows[0].id;
  screening = (await db.query("insert into screenings (client_id, complaint) values ($1, 'Queixa de teste') returning id", [client])).rows[0].id;
});

const draft = (o = {}) =>
  db.query("insert into anamneses (client_id, screening_id, status, assessed_at, evaluation) values ($1, $2, $3, $4, $5) returning id", [client, screening, o.status ?? "draft", o.assessed ?? null, o.evaluation ?? null]);

describe("integridade da anamnese", () => {
  test("só UM rascunho por cliente", async () => {
    await draft();
    assert.equal(await code(draft()), "23505");
  });

  test("concluir exige data da avaliação e algum conteúdo profissional", async () => {
    const id = (await db.query("select id from anamneses where client_id = $1", [client])).rows[0].id;
    assert.equal(await code(db.query("update anamneses set status = 'completed' where id = $1", [id])), "23514", "sem data");
    assert.equal(await code(db.query("update anamneses set status = 'completed', assessed_at = now() where id = $1", [id])), "23514", "sem conteúdo");
    await db.query("update anamneses set status = 'completed', assessed_at = now(), evaluation = 'Avaliação de teste' where id = $1", [id]);
  });

  test("concluída registra completed_at; reabrir limpa", async () => {
    const id = (await db.query("select id from anamneses where client_id = $1", [client])).rows[0].id;
    const a = (await db.query("select completed_at is not null as c from anamneses where id = $1", [id])).rows[0];
    assert.equal(a.c, true);
    await db.query("update anamneses set status = 'draft' where id = $1", [id]);
    assert.equal((await db.query("select completed_at is null as c from anamneses where id = $1", [id])).rows[0].c, true);
    await db.query("update anamneses set status = 'completed' where id = $1", [id]);
  });

  test("reavaliação: com a anterior concluída, pode abrir um novo rascunho (histórico preservado)", async () => {
    await draft();
    assert.equal((await db.query("select count(*)::int n from anamneses where client_id = $1", [client])).rows[0].n, 2);
  });

  test("texto enorme é barrado pelo banco", async () => {
    const other = (await db.query("insert into clients (name, phone) values ('Outra Cliente', '00900002002') returning id")).rows[0].id;
    assert.equal(await code(db.query("insert into anamneses (client_id, evaluation) values ($1, $2)", [other, "x".repeat(7000)])), "23514");
  });
});

describe("a anamnese comanda o estado da triagem", () => {
  test("concluir a anamnese de uma triagem → 'avaliada'", async () => {
    const c2 = (await db.query("insert into clients (name, phone) values ('Cliente Dois', '00900002003') returning id")).rows[0].id;
    const s2 = (await db.query("insert into screenings (client_id, status) values ($1, 'in_review') returning id", [c2])).rows[0].id;
    const a = (await db.query("insert into anamneses (client_id, screening_id) values ($1, $2) returning id", [c2, s2])).rows[0].id;
    assert.equal((await db.query("select status from screenings where id = $1", [s2])).rows[0].status, "in_review", "rascunho não muda nada");
    await db.query("update anamneses set status = 'completed', assessed_at = now(), professional_notes = 'nota' where id = $1", [a]);
    assert.equal((await db.query("select status from screenings where id = $1", [s2])).rows[0].status, "evaluated");
  });

  test("não retrocede: triagem com tratamento proposto continua assim", async () => {
    const c3 = (await db.query("insert into clients (name, phone) values ('Cliente Tres', '00900002004') returning id")).rows[0].id;
    const s3 = (await db.query("insert into screenings (client_id, status) values ($1, 'treatment_proposed') returning id", [c3])).rows[0].id;
    await db.query("insert into anamneses (client_id, screening_id, status, assessed_at, evaluation) values ($1, $2, 'completed', now(), 'x')", [c3, s3]);
    assert.equal((await db.query("select status from screenings where id = $1", [s3])).rows[0].status, "treatment_proposed");
  });
});

describe("dados sensíveis: só admin", () => {
  test("anônimo e usuário sem perfil não leem nem escrevem anamneses", async () => {
    for (const [role, uid] of [["anon", null], ["authenticated", STRANGER]]) {
      const n = await as(db, role, uid, () => db.query("select count(*)::int n from anamneses"));
      assert.equal(n.rows[0].n, 0, role);
      assert.equal(await as(db, role, uid, () => code(db.query("insert into anamneses (client_id) values ($1)", [client]))), "42501", role);
    }
  });

  test("admin lê e registra quem criou (created_by)", async () => {
    const other = (await db.query("insert into clients (name, phone) values ('Cliente Quatro', '00900002005') returning id")).rows[0].id;
    const r = await as(db, "authenticated", ADMIN, () => db.query("insert into anamneses (client_id) values ($1) returning created_by", [other]));
    assert.equal(r.rows[0].created_by, ADMIN);
    const n = await as(db, "authenticated", ADMIN, () => db.query("select count(*)::int n from anamneses"));
    assert.ok(n.rows[0].n >= 1);
  });
});
