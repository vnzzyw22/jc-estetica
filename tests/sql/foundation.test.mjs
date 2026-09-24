import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { as, freshDb } from "./harness.mjs";

const ADMIN = "11111111-1111-1111-1111-111111111111";
const STRANGER = "22222222-2222-2222-2222-222222222222";

/** Próximo dia útil daqui a ≥3 dias, no horário local (-03:00), como timestamptz ISO. */
function futureSlot(hour = 10, minute = 0, daysAhead = 3) {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  while ([0, 6].includes(new Date(d.getTime() - 3 * 3_600_000).getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  const day = new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  return new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`).toISOString();
}

const code = async (promise) => {
  try {
    await promise;
    return null;
  } catch (e) {
    return e.code ?? e.message;
  }
};
const msg = async (promise) => {
  try {
    await promise;
    return null;
  } catch (e) {
    return e.message;
  }
};

let db;
let clientId;
let serviceA;
let serviceB;

before(async () => {
  db = await freshDb({ seed: true });
  await db.query("insert into auth.users (id, email) values ($1, 'admin@x'), ($2, 'stranger@x')", [ADMIN, STRANGER]);
  await db.query("insert into admin_profiles (user_id) values ($1)", [ADMIN]);
  const c = await db.query("insert into clients (name, phone) values ('Cliente Teste', '00900000001') returning id");
  clientId = c.rows[0].id;
  const s = await db.query("select id from services order by display_order limit 2");
  [serviceA, serviceB] = s.rows.map((r) => r.id);
});

describe("catálogo e seed", () => {
  test("12 serviços reais nas 3 categorias; sem preço nem descrição inventados", async () => {
    const r = await db.query("select category, count(*)::int n, count(price)::int com_preco, count(description)::int com_desc from services group by category order by category");
    assert.deepEqual(r.rows.map((x) => [x.category, x.n]), [["corporal_modelagem", 4], ["facial_olhar", 5], ["terapias_bem_estar", 3]]);
    assert.ok(r.rows.every((x) => x.com_preco === 0 && x.com_desc === 0));
  });

  test("categorias de despesa fixas e variáveis existem, sem valores", async () => {
    const r = await db.query("select kind, count(*)::int n from expense_categories group by kind order by kind");
    assert.equal(r.rows.length, 2);
    assert.equal((await db.query("select count(*)::int n from expenses")).rows[0].n, 0);
  });

  test("seed de produção não cria clientes nem dados de saúde", async () => {
    const fresh = await freshDb({ seed: true });
    for (const t of ["clients", "screenings", "anamneses", "treatments", "payments", "appointments"]) {
      assert.equal((await fresh.query(`select count(*)::int n from ${t}`)).rows[0].n, 0, t);
    }
  });
});

describe("agenda única por profissional", () => {
  test("mesmo profissional não pode ter dois horários sobrepostos", async () => {
    const start = futureSlot(9, 0, 10);
    const ins = () =>
      db.query("insert into appointments (client_id, service_id, starts_at, ends_at) values ($1, $2, $3::timestamptz, $3::timestamptz + interval '1 hour')", [clientId, serviceA, start]);
    await ins();
    assert.equal(await code(ins()), "23P01");
  });

  test("duas profissionais podem atender no mesmo horário", async () => {
    const other = (await db.query("insert into professionals (name) values ('Profissional Demo B') returning id")).rows[0].id;
    const start = futureSlot(9, 0, 10);
    await db.query(
      "insert into appointments (client_id, service_id, starts_at, ends_at, professional_id) values ($1, $2, $3::timestamptz, $3::timestamptz + interval '1 hour', $4)",
      [clientId, serviceA, start, other],
    );
  });

  test("avaliação não exige serviço; serviço avulso exige", async () => {
    const start = futureSlot(15, 0, 11);
    await db.query("insert into appointments (client_id, starts_at, ends_at, kind) values ($1, $2::timestamptz, $2::timestamptz + interval '1 hour', 'evaluation')", [clientId, start]);
    const start2 = futureSlot(16, 0, 11);
    assert.equal(
      await code(db.query("insert into appointments (client_id, starts_at, ends_at, kind) values ($1, $2::timestamptz, $2::timestamptz + interval '1 hour', 'service')", [clientId, start2])),
      "23514",
    );
  });

  test("cancelado libera o horário", async () => {
    const start = futureSlot(14, 0, 12);
    const a = (await db.query("insert into appointments (client_id, service_id, starts_at, ends_at) values ($1, $2, $3::timestamptz, $3::timestamptz + interval '1 hour') returning id", [clientId, serviceA, start])).rows[0].id;
    await db.query("update appointments set status = 'cancelled' where id = $1", [a]);
    await db.query("insert into appointments (client_id, service_id, starts_at, ends_at) values ($1, $2, $3::timestamptz, $3::timestamptz + interval '1 hour')", [clientId, serviceA, start]);
  });
});

describe("RLS: dados sensíveis só para admin", () => {
  const sensitive = ["screenings", "anamneses", "treatments", "treatment_sessions", "evolutions", "payments", "expenses", "expense_categories", "treatment_packages", "package_services", "clients", "appointments"];

  test("anônimo não lê (nem escreve) nenhuma tabela sensível", async () => {
    for (const t of sensitive) {
      const rows = await as(db, "anon", null, () => db.query(`select count(*)::int n from ${t}`));
      assert.equal(rows.rows[0].n, 0, `anon leu ${t}`);
    }
    const denied = await as(db, "anon", null, () => code(db.query("insert into payments (kind, amount) values ('other', 10)")));
    assert.equal(denied, "42501");
  });

  test("usuário autenticado que NÃO é admin também não lê nem escreve", async () => {
    for (const t of sensitive) {
      const rows = await as(db, "authenticated", STRANGER, () => db.query(`select count(*)::int n from ${t}`));
      assert.equal(rows.rows[0].n, 0, `não-admin leu ${t}`);
    }
    const cat = (await db.query("select id from expense_categories limit 1")).rows[0].id;
    const denied = await as(db, "authenticated", STRANGER, () => code(db.query("insert into expenses (category_id, description, amount) values ($1, 'x', 1)", [cat])));
    assert.equal(denied, "42501");
  });

  test("admin lê e escreve", async () => {
    const n = await as(db, "authenticated", ADMIN, () => db.query("select count(*)::int n from clients"));
    assert.ok(n.rows[0].n >= 1);
    await as(db, "authenticated", ADMIN, () => db.query("insert into expenses (category_id, description, amount) select id, 'Teste', 1 from expense_categories limit 1"));
  });

  test("público lê só o termo ATIVO e as views sem PII", async () => {
    await db.query("insert into consent_terms (version, body, active) values ('rascunho', 'texto teste', false), ('v1', 'texto ativo teste', true)");
    const terms = await as(db, "anon", null, () => db.query("select version from consent_terms"));
    assert.deepEqual(terms.rows.map((r) => r.version), ["v1"]);
    const busy = await as(db, "anon", null, () => db.query("select * from busy_slots limit 1"));
    assert.deepEqual(Object.keys(busy.rows[0]).sort(), ["ends_at", "professional_id", "starts_at"]);
  });

  test("anônimo não executa as funções administrativas", async () => {
    for (const fn of ["activate_treatment('00000000-0000-0000-0000-000000000000')", "complete_session('00000000-0000-0000-0000-000000000000')", "create_payment_plan('00000000-0000-0000-0000-000000000000', 1, current_date)"]) {
      assert.equal(await as(db, "anon", null, () => code(db.query(`select public.${fn}`))), "42501", fn);
    }
  });
});

describe("triagem pública (submit_screening)", () => {
  const call = (o = {}) => {
    const a = { name: "Lead Demonstração", phone: "00900000101", email: null, source: "instagram", detail: null, interest: "facial_olhar", goal: "Melhorar a textura", complaint: "Pele opaca", desired: "Uniformidade", answers: {}, consent: true, ...o };
    return as(db, "anon", null, () =>
      db.query("select public.submit_screening($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) id", [a.name, a.phone, a.email, a.source, a.detail, a.interest, a.goal, a.complaint, a.desired, JSON.stringify(a.answers), a.consent]),
    );
  };

  test("cria cliente + triagem 'nova' vinculados", async () => {
    const r = await call();
    const row = (await db.query("select s.status, s.source, s.consented_at, c.name, c.phone from screenings s join clients c on c.id = s.client_id where s.id = $1", [r.rows[0].id])).rows[0];
    assert.equal(row.status, "new");
    assert.equal(row.source, "instagram");
    assert.equal(row.name, "Lead Demonstração");
    assert.ok(row.consented_at);
  });

  test("exige consentimento", async () => {
    assert.match(await msg(call({ phone: "00900000102", consent: false })), /consent_required/);
  });

  test("valida nome, telefone, área e formato das respostas", async () => {
    assert.match(await msg(call({ name: "A", phone: "00900000103" })), /invalid_name/);
    assert.match(await msg(call({ phone: "123" })), /invalid_phone/);
    assert.match(await msg(call({ phone: "00900000104", interest: "hackear" })), /invalid_interest/);
    assert.match(await msg(call({ phone: "00900000105", answers: { x: "y".repeat(20000) } })), /invalid_answers/);
  });

  test("NÃO sobrescreve o nome de um cliente existente e guarda o termo ativo", async () => {
    await call({ name: "Impostor Silva", phone: "00900000001" });
    const c = (await db.query("select name from clients where phone = '00900000001'")).rows[0];
    assert.equal(c.name, "Cliente Teste");
    const s = (await db.query("select consent_term_id from screenings order by created_at desc limit 1")).rows[0];
    assert.ok(s.consent_term_id, "guardou o termo ativo vigente");
  });

  test("freio: no máximo 3 triagens por telefone em 24h", async () => {
    for (let i = 0; i < 3; i++) await call({ phone: "00900000199" });
    assert.match(await msg(call({ phone: "00900000199" })), /too_many/);
  });
});

describe("create_booking v2", () => {
  const book = (o = {}) => {
    const a = { service: serviceA, start: futureSlot(10, 0, 20), name: "Fulana Demo", phone: "00900000201", kind: "service", ...o };
    return as(db, "anon", null, () => db.query("select public.create_booking($1::uuid,$2::timestamptz,$3,$4,null,null,$5) id", [a.service, a.start, a.name, a.phone, a.kind]));
  };

  test("serviço avulso: grava kind=service com profissional padrão", async () => {
    const r = await book();
    const a = (await db.query("select kind, professional_id, status from appointments where id = $1", [r.rows[0].id])).rows[0];
    assert.equal(a.kind, "service");
    assert.ok(a.professional_id);
    assert.equal(a.status, "pending");
  });

  test("avaliação sem serviço usa a duração das configurações", async () => {
    await db.query("update settings set evaluation_duration_minutes = 45");
    const r = await book({ service: null, kind: "evaluation", start: futureSlot(10, 0, 21), phone: "00900000202" });
    const a = (await db.query("select (extract(epoch from ends_at - starts_at) / 60)::int as d, service_id, kind from appointments where id = $1", [r.rows[0].id])).rows[0];
    assert.equal(a.kind, "evaluation");
    assert.equal(a.service_id, null);
    assert.equal(a.d, 45);
  });

  test("mesmo horário duas vezes → conflito; fora do expediente → erro; kind inválido → erro", async () => {
    const start = futureSlot(11, 0, 22);
    await book({ start, phone: "00900000203" });
    assert.equal(await code(book({ start, phone: "00900000204" })), "23P01");
    assert.match(await msg(book({ start: futureSlot(20, 0, 22), phone: "00900000205" })), /outside_hours/);
    assert.match(await msg(book({ kind: "session", phone: "00900000206", start: futureSlot(15, 0, 22) })), /invalid_kind/);
  });

  test("respeita bloqueios", async () => {
    const start = futureSlot(15, 0, 23);
    await db.query("insert into blocked_slots (starts_at, ends_at, kind) values ($1::timestamptz, $1::timestamptz + interval '2 hours', 'block')", [start]);
    assert.match(await msg(book({ start, phone: "00900000207" })), /blocked/);
  });

  test("não sobrescreve o nome de cliente existente", async () => {
    await book({ name: "Outro Nome", phone: "00900000001", start: futureSlot(9, 0, 26) });
    assert.equal((await db.query("select name from clients where phone = '00900000001'")).rows[0].name, "Cliente Teste");
  });
});

describe("pacote → tratamento → sessões → agenda → financeiro", () => {
  let pkg;
  let treatment;
  let sessions;

  before(async () => {
    pkg = (await db.query("insert into treatment_packages (name, goal, session_count, interval_days, price, validity_days) values ('Pacote Demo Facial', 'Objetivo demo', 3, 15, 1000.00, 120) returning id")).rows[0].id;
    await db.query("insert into package_services (package_id, service_id, position) values ($1, $2, 1), ($1, $3, 2)", [pkg, serviceA, serviceB]);
  });

  test("cria tratamento 'proposto' copiando o pacote", async () => {
    treatment = (await db.query("select public.create_treatment_from_package($1, $2) id", [clientId, pkg])).rows[0].id;
    const t = (await db.query("select status, total_sessions, price_total, billing_mode, valid_until is not null as tem_validade from treatments where id = $1", [treatment])).rows[0];
    assert.deepEqual([t.status, t.total_sessions, Number(t.price_total), t.billing_mode, t.tem_validade], ["proposed", 3, 1000, "package", true]);
  });

  test("ativar gera N sessões a agendar, alternando os serviços do pacote; é idempotente", async () => {
    assert.equal((await db.query("select public.activate_treatment($1) n", [treatment])).rows[0].n, 3);
    sessions = (await db.query("select id, number, status, service_id from treatment_sessions where treatment_id = $1 order by number", [treatment])).rows;
    assert.deepEqual(sessions.map((s) => s.status), ["unscheduled", "unscheduled", "unscheduled"]);
    assert.deepEqual(sessions.map((s) => s.service_id), [serviceA, serviceB, serviceA]);
    assert.match(await msg(db.query("select public.activate_treatment($1)", [treatment])), /invalid_status/);
    assert.equal((await db.query("select count(*)::int n from treatment_sessions where treatment_id = $1", [treatment])).rows[0].n, 3);
  });

  test("plano de pagamento: 3 parcelas somam exatamente o valor; segundo plano é recusado", async () => {
    assert.equal((await db.query("select public.create_payment_plan($1, 3, current_date, 'pix') n", [treatment])).rows[0].n, 3);
    const p = (await db.query("select amount::float8 a, installment_number n, treatment_id, client_id from payments where treatment_id = $1 order by installment_number", [treatment])).rows;
    assert.deepEqual(p.map((x) => x.a), [333.33, 333.33, 333.34]);
    assert.ok(p.every((x) => x.client_id === clientId && x.treatment_id === treatment), "pagamentos vinculados a cliente e tratamento");
    assert.match(await msg(db.query("select public.create_payment_plan($1, 2, current_date)", [treatment])), /plan_exists/);
  });

  test("agendar sessão cria appointment kind=session vinculado", async () => {
    const start = futureSlot(9, 0, 30);
    const appt = (await db.query("select public.schedule_session($1, $2::timestamptz) id", [sessions[0].id, start])).rows[0].id;
    const a = (await db.query("select kind, client_id, service_id, status from appointments where id = $1", [appt])).rows[0];
    assert.deepEqual([a.kind, a.client_id, a.service_id, a.status], ["session", clientId, serviceA, "pending"]);
    assert.equal((await db.query("select status from treatment_sessions where id = $1", [sessions[0].id])).rows[0].status, "scheduled");
  });

  test("conflito de horário ao agendar é barrado pelo banco", async () => {
    const start = futureSlot(9, 30, 30); // sobrepõe a sessão 1 (9:00–10:00)
    assert.equal(await code(db.query("select public.schedule_session($1, $2::timestamptz)", [sessions[1].id, start])), "23P01");
  });

  test("confirmar o agendamento confirma a sessão", async () => {
    await db.query("update appointments set status = 'confirmed' where id = (select appointment_id from treatment_sessions where id = $1)", [sessions[0].id]);
    assert.equal((await db.query("select status from treatment_sessions where id = $1", [sessions[0].id])).rows[0].status, "confirmed");
  });

  test("reagendar cancela o horário antigo (mesmo para horário sobreposto) e marca 'rescheduled'", async () => {
    const before = (await db.query("select appointment_id from treatment_sessions where id = $1", [sessions[0].id])).rows[0].appointment_id;
    const newAppt = (await db.query("select public.schedule_session($1, $2::timestamptz) id", [sessions[0].id, futureSlot(9, 30, 30)])).rows[0].id;
    assert.notEqual(newAppt, before);
    assert.equal((await db.query("select status from appointments where id = $1", [before])).rows[0].status, "cancelled");
    const s = (await db.query("select status, appointment_id from treatment_sessions where id = $1", [sessions[0].id])).rows[0];
    assert.deepEqual([s.status, s.appointment_id], ["rescheduled", newAppt]);
  });

  test("cancelar o agendamento devolve a sessão para 'a agendar' e libera o horário", async () => {
    const appt = (await db.query("select public.schedule_session($1, $2::timestamptz) id", [sessions[1].id, futureSlot(14, 0, 31)])).rows[0].id;
    await db.query("update appointments set status = 'cancelled' where id = $1", [appt]);
    const s = (await db.query("select status, appointment_id from treatment_sessions where id = $1", [sessions[1].id])).rows[0];
    assert.deepEqual([s.status, s.appointment_id], ["unscheduled", null]);
  });

  test("concluir sessão: appointment concluído, evolução registrada, progresso atualizado", async () => {
    await db.query("select public.complete_session($1, 'Pele respondeu bem (nota demo)')", [sessions[0].id]);
    const s = (await db.query("select status, performed_at is not null as feita from treatment_sessions where id = $1", [sessions[0].id])).rows[0];
    assert.deepEqual([s.status, s.feita], ["completed", true]);
    assert.equal((await db.query("select status from appointments where id = (select appointment_id from treatment_sessions where id = $1)", [sessions[0].id])).rows[0].status, "completed");
    assert.equal((await db.query("select count(*)::int n from evolutions where session_id = $1", [sessions[0].id])).rows[0].n, 1);
    const prog = (await db.query("select completed, total_sessions, scheduled, unscheduled from treatment_progress where treatment_id = $1", [treatment])).rows[0];
    assert.deepEqual([prog.completed, prog.total_sessions, prog.unscheduled], [1, 3, 2]);
    // Cobrança do pacote NÃO duplica por sessão realizada.
    assert.equal((await db.query("select count(*)::int n from payments where treatment_id = $1", [treatment])).rows[0].n, 3);
  });

  test("concluir pela AGENDA (status do appointment) também conclui a sessão", async () => {
    const appt = (await db.query("select public.schedule_session($1, $2::timestamptz) id", [sessions[1].id, futureSlot(14, 0, 32)])).rows[0].id;
    await db.query("update appointments set status = 'completed' where id = $1", [appt]);
    assert.equal((await db.query("select status from treatment_sessions where id = $1", [sessions[1].id])).rows[0].status, "completed");
  });

  test("última sessão concluída encerra o tratamento", async () => {
    await db.query("select public.complete_session($1)", [sessions[2].id]);
    const t = (await db.query("select status, completed_at is not null as fim from treatments where id = $1", [treatment])).rows[0];
    assert.deepEqual([t.status, t.fim], ["completed", true]);
  });

  test("sessões só são agendadas em tratamento ativo", async () => {
    const t2 = (await db.query("select public.create_treatment_from_package($1, $2) id", [clientId, pkg])).rows[0].id;
    assert.match(await msg(db.query("select public.activate_treatment($1) n", ["00000000-0000-0000-0000-000000000000"])), /treatment_not_found/);
    assert.equal((await db.query("select count(*)::int n from treatment_sessions where treatment_id = $1", [t2])).rows[0].n, 0);
  });
});

describe("cobrança por sessão (billing_mode = per_session)", () => {
  test("sessão realizada gera UMA cobrança pendente vinculada; não duplica", async () => {
    const t = (await db.query("insert into treatments (client_id, name, total_sessions, billing_mode, session_price, status) values ($1, 'Avulso Demo', 1, 'per_session', 120.50, 'proposed') returning id", [clientId])).rows[0].id;
    await db.query("select public.activate_treatment($1)", [t]);
    const s = (await db.query("select id from treatment_sessions where treatment_id = $1", [t])).rows[0].id;
    await db.query("select public.complete_session($1)", [s]);
    await db.query("select public.finish_session($1)", [s]);
    const p = (await db.query("select kind, status, amount::float8 a, client_id, treatment_id, session_id from payments where session_id = $1", [s])).rows;
    assert.equal(p.length, 1);
    assert.deepEqual([p[0].kind, p[0].status, p[0].a, p[0].client_id, p[0].treatment_id], ["session", "pending", 120.5, clientId, t]);
  });
});

describe("financeiro integrado", () => {
  test("pagamento pago vira entrada realizada; despesa paga vira saída; previstas ficam 'expected'", async () => {
    const pay = (await db.query("select id from payments where status = 'pending' limit 1")).rows[0].id;
    assert.equal(await code(db.query("update payments set status = 'paid', paid_at = null where id = $1", [pay])), null, "gatilho preenche paid_at");
    assert.ok((await db.query("select paid_at from payments where id = $1", [pay])).rows[0].paid_at);

    const cat = (await db.query("select id from expense_categories where kind = 'fixed' limit 1")).rows[0].id;
    await db.query("insert into expenses (category_id, description, amount, paid_at) values ($1, 'Despesa demo paga', 200, now())", [cat]);
    await db.query("insert into expenses (category_id, description, amount) values ($1, 'Despesa demo a pagar', 50)", [cat]);

    const flow = (await db.query("select direction, state, count(*)::int n from cash_flow group by 1, 2 order by 1, 2")).rows.map((r) => `${r.direction}/${r.state}/${r.n}`);
    assert.ok(flow.includes("in/realized/1"));
    assert.ok(flow.includes("out/realized/1"));
    assert.ok(flow.some((f) => f.startsWith("out/expected/")));
    assert.ok(flow.some((f) => f.startsWith("in/expected/")));
  });

  test("pagamento 'pago' sem data é impossível; valor deve ser positivo; outros recebimentos não exigem cliente", async () => {
    assert.equal(await code(db.query("insert into payments (kind, client_id, amount, status) values ('service', $1, 0, 'pending')", [clientId])), "23514");
    assert.equal(await code(db.query("insert into payments (kind, amount) values ('service', 10)")), "23514");
    await db.query("insert into payments (kind, amount, description) values ('other', 10, 'Recebimento avulso demo')");
  });

  test("pagamentos protegem o histórico: tratamento com cobrança não pode ser apagado", async () => {
    const t = (await db.query("select treatment_id from payments where treatment_id is not null limit 1")).rows[0].treatment_id;
    assert.equal(await code(db.query("delete from treatments where id = $1", [t])), "23001");
  });
});
