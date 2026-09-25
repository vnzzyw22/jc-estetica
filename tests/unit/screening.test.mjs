import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { goalsForArea, normalizeCampaign, normalizeSource, validateScreening, GOAL_OPTIONS } from "../../src/lib/screening.ts";

const valid = {
  area: "facial_olhar",
  complaint: "Manchas e textura irregular",
  goal: "manchas",
  name: "Maria Teste",
  phone: "(44) 99999-8888",
  consent: true,
};

describe("validateScreening", () => {
  test("aceita o mínimo obrigatório e normaliza", () => {
    const r = validateScreening(valid);
    assert.equal(r.ok, true);
    assert.equal(r.value.phone, "44999998888");
    assert.equal(r.value.email, null);
    assert.deepEqual(r.value.answers, {});
  });

  test("informa TODOS os erros de uma vez, por campo", () => {
    const r = validateScreening({ area: "x", complaint: "curto", goal: "y", name: "A", phone: "12", email: "sem-arroba", consent: false });
    assert.equal(r.ok, false);
    for (const k of ["area", "complaint", "goal", "name", "phone", "email", "consent"]) assert.ok(r.errors[k], k);
  });

  test("consentimento precisa ser exatamente true (string 'true' não vale)", () => {
    assert.equal(validateScreening({ ...valid, consent: "true" }).ok, false);
    assert.equal(validateScreening({ ...valid, consent: 1 }).ok, false);
  });

  test("objetivo precisa combinar com a área escolhida", () => {
    assert.equal(validateScreening({ ...valid, area: "corporal_modelagem", goal: "manchas" }).ok, false);
    assert.equal(validateScreening({ ...valid, area: "corporal_modelagem", goal: "reduzir_medidas" }).ok, true);
    assert.equal(validateScreening({ ...valid, area: "not_sure", goal: "manchas" }).ok, true);
  });

  test("respostas opcionais desconhecidas são DESCARTADAS (nunca viram texto livre nas chaves)", () => {
    const r = validateScreening({ ...valid, duration: "<script>", previous: "yes", period: "morning", visits: "1_2", contactPreference: "whatsapp", notes: "Alergia a X" });
    assert.equal(r.ok, true);
    assert.deepEqual(r.value.answers, { previous_treatment: "yes", notes: "Alergia a X", preferred_period: "morning", visits_per_month: "1_2", contact_preference: "whatsapp" });
  });

  test("remove caracteres de controle e limita o tamanho", () => {
    const r = validateScreening({ ...valid, complaint: "Manchas\u0000\u0007 no rosto " + "a".repeat(5000), notes: "n".repeat(5000) });
    assert.equal(r.ok, true);
    assert.ok(!/[\u0000-\u0008]/.test(r.value.complaint));
    assert.ok(r.value.complaint.length <= 1000);
    assert.ok(r.value.answers.notes.length <= 600);
  });

  test("telefone: aceita 10 ou 11 dígitos, recusa 9 e 12", () => {
    assert.equal(validateScreening({ ...valid, phone: "4433334444" }).ok, true);
    assert.equal(validateScreening({ ...valid, phone: "443333444" }).ok, false);
    assert.equal(validateScreening({ ...valid, phone: "449999988887" }).ok, false);
  });

  test("entradas não-string não quebram a validação", () => {
    const r = validateScreening({ area: null, complaint: 5, goal: {}, name: [], phone: undefined, consent: undefined });
    assert.equal(r.ok, false);
  });
});

describe("opções e origem", () => {
  test("todo objetivo tem ao menos uma área e 'outro' aparece em todas", () => {
    assert.ok(GOAL_OPTIONS.every((g) => g.areas.length > 0));
    for (const a of ["facial_olhar", "corporal_modelagem", "terapias_bem_estar", "not_sure"]) assert.ok(goalsForArea(a).some((g) => g.value === "outro"), a);
  });

  test("origem: aceita instagram e apelidos; qualquer outra coisa vira 'site'", () => {
    assert.equal(normalizeSource("Instagram"), "instagram");
    assert.equal(normalizeSource("ig"), "instagram");
    assert.equal(normalizeSource("indicação"), "referral");
    assert.equal(normalizeSource("<script>"), "site");
    assert.equal(normalizeSource(undefined), "site");
  });

  test("campanha: só caracteres seguros, até 80", () => {
    assert.equal(normalizeCampaign("reels-setembro_1"), "reels-setembro_1");
    assert.equal(normalizeCampaign("<img src=x>"), null);
    assert.equal(normalizeCampaign("x".repeat(81)), null);
    assert.equal(normalizeCampaign(""), null);
  });
});
