import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { clientStage } from "../../src/lib/client-stage.ts";
import { validateAnamnesis } from "../../src/lib/anamnesis.ts";

const none = { screenings: [], treatments: [], appointments: [] };

describe("clientStage", () => {
  test("enviou triagem e nada mais → lead", () => {
    assert.equal(clientStage({ ...none, screenings: [{ status: "new" }] }), "lead");
  });

  test("lead com só uma AVALIAÇÃO agendada continua lead", () => {
    assert.equal(clientStage({ ...none, screenings: [{ status: "evaluation_scheduled" }], appointments: [{ status: "confirmed", kind: "evaluation" }] }), "lead");
  });

  test("avaliação concluída sozinha ainda não é cliente (ela é avaliada, mas não atendida)", () => {
    assert.equal(clientStage({ ...none, screenings: [{ status: "evaluated" }], appointments: [{ status: "completed", kind: "evaluation" }] }), "lead");
  });

  test("agendou um serviço ou sessão → cliente", () => {
    assert.equal(clientStage({ ...none, screenings: [{ status: "new" }], appointments: [{ status: "pending", kind: "service" }] }), "cliente");
    assert.equal(clientStage({ ...none, appointments: [{ status: "completed", kind: "session" }] }), "cliente");
  });

  test("agendamento CANCELADO não faz de ninguém cliente", () => {
    assert.equal(clientStage({ ...none, screenings: [{ status: "new" }], appointments: [{ status: "cancelled", kind: "service" }] }), "lead");
  });

  test("tratamento ativo ou pausado → em tratamento (vence tudo)", () => {
    assert.equal(clientStage({ ...none, treatments: [{ status: "active" }], appointments: [{ status: "completed", kind: "session" }] }), "em_tratamento");
    assert.equal(clientStage({ ...none, treatments: [{ status: "paused" }] }), "em_tratamento");
  });

  test("tratamento proposto não muda nada; concluído → cliente", () => {
    assert.equal(clientStage({ ...none, screenings: [{ status: "treatment_proposed" }], treatments: [{ status: "proposed" }] }), "lead");
    assert.equal(clientStage({ ...none, treatments: [{ status: "completed" }] }), "cliente");
  });

  test("cadastrada à mão, sem triagem nem agenda → cliente", () => {
    assert.equal(clientStage(none), "cliente");
  });
});

describe("validateAnamnesis", () => {
  const TODAY = "2026-09-26";

  test("rascunho aceita tudo vazio", () => {
    const r = validateAnamnesis({}, "draft", TODAY);
    assert.equal(r.ok, true);
    assert.equal(r.value.assessed_at, null);
  });

  test("concluir exige data e conteúdo profissional", () => {
    const r = validateAnamnesis({}, "complete", TODAY);
    assert.equal(r.ok, false);
    assert.ok(r.errors.assessed_at);
    assert.ok(r.errors.form);
    assert.equal(validateAnamnesis({ assessed_at: TODAY, evaluation: "Avaliação feita" }, "complete", TODAY).ok, true);
  });

  test("só 'informações adicionais' NÃO basta para concluir", () => {
    assert.equal(validateAnamnesis({ assessed_at: TODAY, additional_info: "algo" }, "complete", TODAY).ok, false);
  });

  test("data: inválida ou no futuro é recusada", () => {
    assert.ok(validateAnamnesis({ assessed_at: "2026-02-31" }, "draft", TODAY).errors.assessed_at);
    assert.ok(validateAnamnesis({ assessed_at: "27/09/2026" }, "draft", TODAY).errors.assessed_at);
    assert.ok(validateAnamnesis({ assessed_at: "2026-09-27" }, "draft", TODAY).errors.assessed_at);
    assert.equal(validateAnamnesis({ assessed_at: "2026-09-26" }, "draft", TODAY).ok, true);
  });

  test("limita o tamanho, limpa caracteres de controle e apara espaços", () => {
    const big = validateAnamnesis({ evaluation: "x".repeat(6001) }, "draft", TODAY);
    assert.equal(big.ok, false);
    assert.ok(big.errors.evaluation);
    const ok = validateAnamnesis({ evaluation: "  Texto\u0000 limpo  ", professional_notes: "   " }, "draft", TODAY);
    assert.equal(ok.value.evaluation, "Texto limpo");
    assert.equal(ok.value.professional_notes, null);
  });

  test("valores não-string não quebram", () => {
    assert.equal(validateAnamnesis({ evaluation: 5, assessed_at: {} }, "draft", TODAY).ok, true);
  });
});
