import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { nextOpenSession, sessionActions, sessionProgress, treatmentActions, validateEvolution, validatePackage, validateTreatment } from "../../src/lib/treatment.ts";

const s = (number, status) => ({ number, status });

describe("treatmentActions", () => {
  test("cada estado permite só o que faz sentido", () => {
    assert.deepEqual(treatmentActions("proposed"), { start: true, resume: false, pause: false, cancel: true, remove: true, edit: true });
    assert.deepEqual(treatmentActions("active"), { start: false, resume: false, pause: true, cancel: true, remove: false, edit: true });
    assert.deepEqual(treatmentActions("paused"), { start: false, resume: true, pause: false, cancel: true, remove: false, edit: true });
  });
  test("concluído e cancelado são histórico", () => {
    for (const st of ["completed", "cancelled"]) assert.deepEqual(treatmentActions(st), { start: false, resume: false, pause: false, cancel: false, remove: false, edit: false });
  });
});

describe("sessionActions", () => {
  test("só em tratamento ativo e sessão em aberto", () => {
    for (const st of ["unscheduled", "scheduled", "confirmed", "rescheduled"]) assert.deepEqual(sessionActions(st, "active"), { schedule: true, complete: true }, st);
    for (const st of ["completed", "cancelled"]) assert.deepEqual(sessionActions(st, "active"), { schedule: false, complete: false }, st);
    for (const tr of ["proposed", "paused", "completed", "cancelled"]) assert.deepEqual(sessionActions("unscheduled", tr), { schedule: false, complete: false }, tr);
  });
});

describe("sessionProgress", () => {
  test("conta cada estado; cancelada sai do percentual", () => {
    const p = sessionProgress([s(1, "completed"), s(2, "completed"), s(3, "confirmed"), s(4, "rescheduled"), s(5, "unscheduled"), s(6, "cancelled")]);
    assert.deepEqual(p, { total: 6, done: 2, booked: 2, toSchedule: 1, cancelled: 1, percent: 40 });
  });
  test("sem sessões ou tudo cancelado: 0%, sem divisão por zero", () => {
    assert.equal(sessionProgress([]).percent, 0);
    assert.equal(sessionProgress([s(1, "cancelled")]).percent, 0);
  });
  test("tudo realizado: 100%", () => {
    assert.equal(sessionProgress([s(1, "completed"), s(2, "completed")]).percent, 100);
  });
});

describe("nextOpenSession", () => {
  test("a de menor número ainda em aberto, mesmo fora de ordem", () => {
    assert.equal(nextOpenSession([s(3, "unscheduled"), s(1, "completed"), s(2, "scheduled")]).number, 2);
  });
  test("nenhuma em aberto → undefined", () => {
    assert.equal(nextOpenSession([s(1, "completed"), s(2, "cancelled")]), undefined);
  });
});

describe("validatePackage", () => {
  const ok = { name: "Protocolo Facial", session_count: "8" };
  test("mínimo: nome e número de sessões; o resto vira null", () => {
    const r = validatePackage(ok);
    assert.equal(r.ok, true);
    assert.deepEqual(r.value, { name: "Protocolo Facial", description: null, goal: null, session_count: 8, interval_days: null, frequency_note: null, price: null, validity_days: null, notes: null });
  });
  test("informa todos os erros de uma vez", () => {
    const r = validatePackage({ name: "A", session_count: "0", interval_days: "x", validity_days: "9999", price: Number.NaN });
    assert.equal(r.ok, false);
    for (const k of ["name", "session_count", "interval_days", "validity_days", "price"]) assert.ok(r.errors[k], k);
  });
  test("valor negativo e texto solto são recusados; zero é permitido", () => {
    assert.ok(validatePackage({ ...ok, price: -1 }).errors.price);
    assert.equal(validatePackage({ ...ok, price: 0 }).ok, true);
    assert.ok(validatePackage({ ...ok, session_count: "3,5" }).errors.session_count);
  });
  test("limpa caracteres de controle e limita o tamanho", () => {
    assert.equal(validatePackage({ ...ok, name: "  Pacote\u0000 Bom  " }).value.name, "Pacote Bom");
    assert.ok(validatePackage({ ...ok, goal: "x".repeat(301) }).errors.goal);
  });
  test("entradas que não são texto não quebram", () => {
    assert.equal(validatePackage({ name: 5, session_count: {} }).ok, false);
  });
});

describe("validateTreatment", () => {
  const ok = { name: "Drenagem 10x", total_sessions: "10" };
  test("pacote fechado é o padrão; valor é opcional", () => {
    const r = validateTreatment(ok);
    assert.equal(r.ok, true);
    assert.equal(r.value.billing_mode, "package");
    assert.equal(r.value.price_total, null);
  });
  test("cobrança por sessão exige o valor da sessão", () => {
    assert.ok(validateTreatment({ ...ok, billing_mode: "per_session" }).errors.session_price);
    assert.ok(validateTreatment({ ...ok, billing_mode: "per_session", session_price: 0 }).errors.session_price);
    const r = validateTreatment({ ...ok, billing_mode: "per_session", session_price: 180 });
    assert.equal(r.ok, true);
    assert.equal(r.value.session_price, 180);
  });
  test("modo desconhecido cai em pacote fechado (nunca grava lixo)", () => {
    assert.equal(validateTreatment({ ...ok, billing_mode: "<script>" }).value.billing_mode, "package");
  });
  test("validade: data real ou vazia", () => {
    assert.equal(validateTreatment({ ...ok, valid_until: "2026-12-31" }).value.valid_until, "2026-12-31");
    assert.ok(validateTreatment({ ...ok, valid_until: "2026-02-31" }).errors.valid_until);
    assert.ok(validateTreatment({ ...ok, valid_until: "31/12/2026" }).errors.valid_until);
    assert.equal(validateTreatment({ ...ok, valid_until: "" }).value.valid_until, null);
  });
  test("sessões e nome são obrigatórios", () => {
    const r = validateTreatment({});
    assert.ok(r.errors.name && r.errors.total_sessions);
  });
});

describe("validateEvolution", () => {
  test("aceita texto, apara espaços", () => {
    assert.deepEqual(validateEvolution("  Pele respondeu bem.  "), { ok: true, value: "Pele respondeu bem." });
  });
  test("vazio, curto demais ou enorme são recusados", () => {
    assert.equal(validateEvolution("").ok, false);
    assert.equal(validateEvolution(" x ").ok, false);
    assert.equal(validateEvolution("a".repeat(4001)).ok, false);
    assert.equal(validateEvolution("a".repeat(4000)).ok, true);
    assert.equal(validateEvolution(null).ok, false);
  });
});
