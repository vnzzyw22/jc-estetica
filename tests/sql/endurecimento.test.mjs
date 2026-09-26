import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { as, freshDb } from "./harness.mjs";

const ADMIN = "11111111-1111-1111-1111-111111111111";
const STRANGER = "22222222-2222-2222-2222-222222222222";
const ZERO = "00000000-0000-0000-0000-000000000000";

const msg = async (p) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e.message;
  }
};
const code = async (p) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e.code ?? e.message;
  }
};

/** Dias úteis distintos (a partir de +8 dias, dentro da janela de 60), no horário local -03:00. Cada chamada de next() devolve um dia novo. */
const weekdays = (() => {
  const out = [];
  for (let d = 8; out.length < 30; d++) {
    const local = new Date(Date.now() + d * 86_400_000 - 3 * 3_600_000);
    if (![0, 6].includes(local.getUTCDay())) out.push(local.toISOString().slice(0, 10));
  }
  return out;
})();
let cursor = 0;
const next = (hour = 10) => new Date(`${weekdays[cursor++]}T${String(hour).padStart(2, "0")}:00:00-03:00`).toISOString();

let db;
let service;
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const book = (phone, start, o = {}) =>
  as(db, "anon", null, () => db.query("select public.create_booking($1::uuid, $2::timestamptz, $3, $4, $5, $6, 'service') id", [service, start, o.name ?? "Cliente Freio", phone, o.email ?? null, o.notes ?? null]));

before(async () => {
  db = await freshDb({ seed: true });
  await db.query("insert into auth.users (id, email) values ($1, 'admin@x'), ($2, 'stranger@x')", [ADMIN, STRANGER]);
  await db.query("insert into admin_profiles (user_id) values ($1)", [ADMIN]);
  service = (await one("select id from services order by display_order limit 1")).id;
});

describe("create_booking v3: freio por telefone", () => {
  test("até 3 reservas futuras pelo site; a 4ª é recusada", async () => {
    for (let i = 0; i < 3; i++) await book("00900004001", next());
    assert.match(await msg(book("00900004001", next())), /too_many/);
    assert.equal((await one("select count(*)::int n from appointments a join clients c on c.id = a.client_id where c.phone = '00900004001'")).n, 3);
  });

  test("outro telefone não é afetado", async () => {
    await book("00900004002", next());
  });

  test("reserva cancelada libera uma vaga na cota", async () => {
    await db.query("update appointments set status = 'cancelled' where id = (select a.id from appointments a join clients c on c.id = a.client_id where c.phone = '00900004001' order by a.starts_at limit 1)");
    await book("00900004001", next());
    assert.match(await msg(book("00900004001", next())), /too_many/);
  });

  test("agendamentos criados pelo painel e os passados NÃO contam", async () => {
    const c = (await one("insert into clients (name, phone) values ('Cliente Painel', '00900004003') returning id")).id;
    for (let i = 0; i < 4; i++) {
      await db.query("insert into appointments (client_id, service_id, starts_at, ends_at, source) values ($1, $2, $3::timestamptz, $3::timestamptz + interval '1 hour', 'admin')", [c, service, next()]);
    }
    await db.query("insert into appointments (client_id, service_id, starts_at, ends_at, source, status) values ($1, $2, now() - interval '5 days', now() - interval '5 days' + interval '1 hour', 'site', 'completed')", [c, service]);
    await book("00900004003", next());
  });

  test("as regras da v2 continuam: conflito, fora do expediente e antecedência", async () => {
    const start = next();
    await book("00900004004", start);
    assert.equal(await code(book("00900004005", start)), "23P01");
    assert.match(await msg(book("00900004006", next(22))), /outside_hours/);
    assert.match(await msg(book("00900004007", new Date(Date.now() + 60_000).toISOString())), /too_soon/);
  });

  test("nome enorme é recusado; e-mail e observações são cortados no máximo", async () => {
    assert.match(await msg(book("00900004008", next(), { name: "N".repeat(121) })), /invalid_name/);
    const id = (await book("00900004009", next(), { email: `${"e".repeat(300)}@x.com`, notes: "n".repeat(3000) })).rows[0].id;
    const a = await one("select length(a.notes)::int n, length(c.email)::int e from appointments a join clients c on c.id = a.client_id where a.id = $1", [id]);
    assert.equal(a.n, 1000);
    assert.equal(a.e, 200);
  });

  test("anônimo continua podendo reservar (a função pública segue com o mesmo acesso)", async () => {
    const r = await book("00900004010", next());
    assert.ok(r.rows[0].id);
  });
});

describe("activate_consent_term", () => {
  let t1;
  let t2;
  before(async () => {
    t1 = (await one("insert into consent_terms (version, body, active, published_at) values ('v1', 'texto v1', true, now()) returning id")).id;
    t2 = (await one("insert into consent_terms (version, body, active) values ('v2', 'texto v2', false) returning id")).id;
  });
  const active = async () => (await db.query("select version from consent_terms where kind = 'screening' and active")).rows.map((r) => r.version);

  test("troca o termo em vigor: o antigo desativa e o novo ativa, sempre com UM só ativo", async () => {
    await db.query("select public.activate_consent_term($1)", [t2]);
    assert.deepEqual(await active(), ["v2"]);
    assert.ok((await one("select published_at from consent_terms where id = $1", [t2])).published_at);
    await db.query("select public.activate_consent_term($1)", [t1]);
    assert.deepEqual(await active(), ["v1"]);
  });

  test("ativar o que já está ativo é inofensivo", async () => {
    await db.query("select public.activate_consent_term($1)", [t1]);
    assert.deepEqual(await active(), ["v1"]);
  });

  test("termo inexistente: nada muda (o vigente continua)", async () => {
    assert.match(await msg(db.query("select public.activate_consent_term($1)", [ZERO])), /term_not_found/);
    assert.deepEqual(await active(), ["v1"]);
  });

  test("permissões: anônimo barrado; usuária sem perfil não enxerga o termo", async () => {
    assert.equal(await as(db, "anon", null, () => code(db.query("select public.activate_consent_term($1)", [t2]))), "42501");
    assert.match(await as(db, "authenticated", STRANGER, () => msg(db.query("select public.activate_consent_term($1)", [t2]))), /term_not_found/);
    assert.deepEqual(await active(), ["v1"]);
  });

  test("admin troca normalmente", async () => {
    await as(db, "authenticated", ADMIN, () => db.query("select public.activate_consent_term($1)", [t2]));
    assert.deepEqual(await active(), ["v2"]);
  });
});
