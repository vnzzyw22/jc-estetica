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

let db;
let client;
let svcA;
let svcB;
let svcC;
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
/** Um horário futuro qualquer (schedule_session não confere o expediente, só bloqueio e conflito). */
const slot = (days, hour = 10) => new Date(Date.now() + days * 86_400_000 + hour * 3_600_000).toISOString();

/** Tratamento ativo de N sessões, a partir de um pacote com os serviços informados. */
async function activeTreatment(sessions = 3, name = "Protocolo Demo") {
  const pkg = (await one("insert into treatment_packages (name, session_count, price) values ($1, $2, 900) returning id", [name, sessions])).id;
  await db.query("select public.save_package_services($1, $2::uuid[])", [pkg, [svcA, svcB]]);
  const t = (await one("select public.create_treatment_from_package($1, $2) id", [client, pkg])).id;
  await db.query("select public.activate_treatment($1)", [t]);
  const s = (await db.query("select id, number from treatment_sessions where treatment_id = $1 order by number", [t])).rows;
  return { t, s };
}

before(async () => {
  db = await freshDb({ seed: true });
  await db.query("insert into auth.users (id, email) values ($1, 'admin@x'), ($2, 'stranger@x')", [ADMIN, STRANGER]);
  await db.query("insert into admin_profiles (user_id) values ($1)", [ADMIN]);
  client = (await one("insert into clients (name, phone) values ('Cliente Tratamento', '00900003001') returning id")).id;
  [svcA, svcB, svcC] = (await db.query("select id from services order by display_order limit 3")).rows.map((r) => r.id);
});

describe("save_package_services", () => {
  let pkg;
  before(async () => {
    pkg = (await one("insert into treatment_packages (name, session_count) values ('Pacote Serviços', 4) returning id")).id;
  });
  const order = async () => (await db.query("select service_id, position from package_services where package_id = $1 order by position", [pkg])).rows;

  test("grava na ordem recebida, posições 1, 2, 3", async () => {
    assert.equal((await one("select public.save_package_services($1, $2::uuid[]) n", [pkg, [svcB, svcA, svcC]])).n, 3);
    const rows = await order();
    assert.deepEqual(rows.map((r) => r.service_id), [svcB, svcA, svcC]);
    assert.deepEqual(rows.map((r) => r.position), [1, 2, 3]);
  });

  test("substitui a lista inteira; lista vazia limpa", async () => {
    await db.query("select public.save_package_services($1, $2::uuid[])", [pkg, [svcC]]);
    assert.deepEqual((await order()).map((r) => r.service_id), [svcC]);
    assert.equal((await one("select public.save_package_services($1, '{}'::uuid[]) n", [pkg])).n, 0);
    assert.equal((await order()).length, 0);
  });

  test("serviço repetido é recusado e a lista antiga continua intacta", async () => {
    await db.query("select public.save_package_services($1, $2::uuid[])", [pkg, [svcA, svcB]]);
    assert.match(await msg(db.query("select public.save_package_services($1, $2::uuid[])", [pkg, [svcA, svcA]])), /duplicate_service/);
    assert.deepEqual((await order()).map((r) => r.service_id), [svcA, svcB]);
  });

  test("pacote inexistente", async () => {
    assert.match(await msg(db.query("select public.save_package_services($1, '{}'::uuid[])", [ZERO])), /package_not_found/);
  });

  test("a ordem do pacote define o rodízio das sessões ao ativar", async () => {
    await db.query("select public.save_package_services($1, $2::uuid[])", [pkg, [svcB, svcA]]);
    const t = (await one("select public.create_treatment_from_package($1, $2) id", [client, pkg])).id;
    await db.query("select public.activate_treatment($1)", [t]);
    const services = (await db.query("select service_id from treatment_sessions where treatment_id = $1 order by number", [t])).rows.map((r) => r.service_id);
    assert.deepEqual(services, [svcB, svcA, svcB, svcA]);
  });
});

describe("cancel_treatment", () => {
  test("cancela as sessões em aberto e libera os horários; a realizada fica", async () => {
    const { t, s } = await activeTreatment(3);
    const a2 = (await one("select public.schedule_session($1, $2::timestamptz) id", [s[1].id, slot(40)])).id;
    const a1 = (await one("select public.schedule_session($1, $2::timestamptz) id", [s[0].id, slot(41)])).id;
    await db.query("select public.complete_session($1, 'feita')", [s[0].id]);

    assert.equal((await one("select public.cancel_treatment($1) n", [t])).n, 2, "duas sessões em aberto");
    const sessions = (await db.query("select number, status from treatment_sessions where treatment_id = $1 order by number", [t])).rows;
    assert.deepEqual(sessions.map((x) => x.status), ["completed", "cancelled", "cancelled"]);
    assert.equal((await one("select status from treatments where id = $1", [t])).status, "cancelled");
    assert.equal((await one("select status from appointments where id = $1", [a2])).status, "cancelled", "horário da sessão 2 liberado");
    assert.equal((await one("select status from appointments where id = $1", [a1])).status, "completed", "o atendimento realizado não é desfeito");
    // O horário liberado volta a aceitar agendamento.
    await db.query("insert into appointments (client_id, kind, starts_at, ends_at) values ($1, 'other', $2::timestamptz, $2::timestamptz + interval '1 hour')", [client, slot(40)]);
  });

  test("não mexe nas cobranças", async () => {
    const { t } = await activeTreatment(2);
    await db.query("select public.create_payment_plan($1, 2, current_date, 'pix')", [t]);
    await db.query("select public.cancel_treatment($1)", [t]);
    assert.equal((await one("select count(*)::int n from payments where treatment_id = $1 and status = 'pending'", [t])).n, 2);
  });

  test("tratamento proposto (sem sessões) também cancela; concluído ou cancelado não", async () => {
    const pkg = (await one("insert into treatment_packages (name, session_count) values ('P', 1) returning id")).id;
    const t = (await one("select public.create_treatment_from_package($1, $2) id", [client, pkg])).id;
    assert.equal((await one("select public.cancel_treatment($1) n", [t])).n, 0);
    assert.match(await msg(db.query("select public.cancel_treatment($1)", [t])), /invalid_status/);
    const done = (await one("insert into treatments (client_id, name, total_sessions, status) values ($1, 'Feito', 1, 'completed') returning id", [client])).id;
    assert.match(await msg(db.query("select public.cancel_treatment($1)", [done])), /invalid_status/);
    assert.match(await msg(db.query("select public.cancel_treatment($1)", [ZERO])), /treatment_not_found/);
  });

  test("depois de cancelado, não dá para agendar sessão", async () => {
    const { t, s } = await activeTreatment(2);
    await db.query("select public.cancel_treatment($1)", [t]);
    assert.match(await msg(db.query("select public.schedule_session($1, $2::timestamptz)", [s[0].id, slot(60)])), /session_closed/);
  });
});

describe("pause_treatment e retomar", () => {
  test("pausa só tratamento ativo; retomar (activate_treatment) não duplica sessões", async () => {
    const { t } = await activeTreatment(3);
    await db.query("select public.pause_treatment($1)", [t]);
    assert.equal((await one("select status from treatments where id = $1", [t])).status, "paused");
    assert.match(await msg(db.query("select public.pause_treatment($1)", [t])), /invalid_status/, "já pausado");
    await db.query("select public.activate_treatment($1)", [t]);
    assert.equal((await one("select status from treatments where id = $1", [t])).status, "active");
    assert.equal((await one("select count(*)::int n from treatment_sessions where treatment_id = $1", [t])).n, 3);
    assert.match(await msg(db.query("select public.pause_treatment($1)", [ZERO])), /treatment_not_found/);
  });

  test("com o tratamento pausado não se agenda sessão", async () => {
    const { t, s } = await activeTreatment(2);
    await db.query("select public.pause_treatment($1)", [t]);
    assert.match(await msg(db.query("select public.schedule_session($1, $2::timestamptz)", [s[0].id, slot(70)])), /treatment_not_active/);
  });

  test("proposto não pausa", async () => {
    const pkg = (await one("insert into treatment_packages (name, session_count) values ('P2', 1) returning id")).id;
    const t = (await one("select public.create_treatment_from_package($1, $2) id", [client, pkg])).id;
    assert.match(await msg(db.query("select public.pause_treatment($1)", [t])), /invalid_status/);
  });
});

describe("evolução e sessão fora de agenda", () => {
  test("concluir sessão que nunca foi agendada é permitido e registra a evolução", async () => {
    const { t, s } = await activeTreatment(2);
    await db.query("select public.complete_session($1, 'Atendimento sem horário marcado')", [s[0].id]);
    assert.equal((await one("select status from treatment_sessions where id = $1", [s[0].id])).status, "completed");
    assert.equal((await one("select count(*)::int n from evolutions where treatment_id = $1", [t])).n, 1);
  });
});

describe("permissões", () => {
  test("visitante (anon) não executa as três funções", async () => {
    for (const fn of [`cancel_treatment('${ZERO}')`, `pause_treatment('${ZERO}')`, `save_package_services('${ZERO}', '{}'::uuid[])`]) {
      assert.equal(await as(db, "anon", null, () => code(db.query(`select public.${fn}`))), "42501", fn);
    }
  });

  test("usuária autenticada que NÃO é admin: a RLS esconde tudo, nada acontece", async () => {
    const { t } = await activeTreatment(2);
    const denied = await as(db, "authenticated", STRANGER, () => msg(db.query("select public.cancel_treatment($1)", [t])));
    assert.match(denied, /treatment_not_found/);
    assert.equal((await one("select status from treatments where id = $1", [t])).status, "active");
    const pkg = (await one("select id from treatment_packages limit 1")).id;
    assert.match(await as(db, "authenticated", STRANGER, () => msg(db.query("select public.save_package_services($1, '{}'::uuid[])", [pkg]))), /package_not_found/);
  });

  test("admin executa normalmente", async () => {
    const { t } = await activeTreatment(2);
    await as(db, "authenticated", ADMIN, () => db.query("select public.pause_treatment($1)", [t]));
    assert.equal((await one("select status from treatments where id = $1", [t])).status, "paused");
  });
});
