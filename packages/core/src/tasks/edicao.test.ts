import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  editarTarefa,
  HoraInvalidaError,
  normalizarTags,
  regraDaRepeticao,
  repeticaoDaRegra,
  TituloVazioError,
} from "./edicao.ts";
import { INBOX_ID, type Tarefa } from "./tarefas.ts";

const HOJE = "2026-11-24"; // terça
const AGORA = "2026-11-24T13:00:00.000Z";
const t = (p: Partial<Tarefa> = {}): Tarefa => ({
  id: "t1", titulo: "tarefa", status: "aberta", prioridade: 0, data: null, hora: null, rrule: null, tags: [],
  listaId: INBOX_ID, criadoEm: "2026-11-01T00:00:00.000Z", atualizadoEm: "2026-11-01T00:00:00.000Z", ...p,
});
const editar = (base: Tarefa, m: Parameters<typeof editarTarefa>[1]) => editarTarefa(base, m, AGORA, HOJE);

test("tags normalizadas como no quick-add", () => {
  assert.deepEqual(normalizarTags("casa, #Mercado urgente  casa;#MERCADO"), ["casa", "mercado", "urgente"]);
  assert.deepEqual(normalizarTags("  "), []);
  assert.deepEqual(normalizarTags("#cálculo trabalho/2026 a!b"), ["cálculo", "trabalho/2026", "ab"]);
});

describe("título, notas e hora", () => {
  test("título é aparado e não pode ficar vazio", () => {
    assert.equal(editar(t(), { titulo: "  novo  " }).titulo, "novo");
    assert.throws(() => editar(t(), { titulo: "   " }), TituloVazioError);
  });
  test("notas vazias somem; notas com texto ficam como estão", () => {
    assert.equal(editar(t({ notas: "x" }), { notas: "  " }).notas, undefined);
    assert.equal(editar(t(), { notas: "linha 1\nlinha 2" }).notas, "linha 1\nlinha 2");
  });
  test("hora inválida é recusada", () => {
    assert.throws(() => editar(t({ data: HOJE }), { hora: "25:00" }), HoraInvalidaError);
    assert.equal(editar(t({ data: HOJE }), { hora: "07:30" }).hora, "07:30");
  });
  test("toda edição atualiza atualizadoEm e mantém id e criadoEm", () => {
    const e = editar(t(), { prioridade: 3 });
    assert.equal(e.atualizadoEm, AGORA);
    assert.equal(e.id, "t1");
    assert.equal(e.criadoEm, "2026-11-01T00:00:00.000Z");
  });
});

describe("coerência entre data, hora e repetição", () => {
  test("tirar a data tira hora e repetição", () => {
    const e = editar(t({ data: HOJE, hora: "09:00", rrule: "FREQ=DAILY" }), { data: null });
    assert.deepEqual([e.data, e.hora, e.rrule], [null, null, null]);
  });
  test("hora sem data não fica", () => {
    assert.equal(editar(t(), { hora: "09:00" }).hora, null);
  });
  test("repetição sem data usa hoje", () => {
    const e = editar(t(), { rrule: "FREQ=DAILY" });
    assert.equal(e.data, HOJE);
    assert.equal(e.rrule, "FREQ=DAILY");
  });
  test("mudar a data de 'toda semana' leva a regra para o novo dia", () => {
    const base = t({ data: HOJE, rrule: "FREQ=WEEKLY;BYDAY=TU" });
    assert.equal(editar(base, { data: "2026-11-27" }).rrule, "FREQ=WEEKLY;BYDAY=FR");
  });
  test("mudar a data de 'todo mês' leva o dia do mês junto", () => {
    const base = t({ data: "2026-12-05", rrule: "FREQ=MONTHLY;BYMONTHDAY=5" });
    assert.equal(editar(base, { data: "2026-12-10" }).rrule, "FREQ=MONTHLY;BYMONTHDAY=10");
  });
  test("regra personalizada não é mexida ao mudar a data", () => {
    const base = t({ data: "2026-11-23", rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR" });
    assert.equal(editar(base, { data: "2026-11-25" }).rrule, "FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });
});

describe("repetições prontas", () => {
  test("regra de cada opção, ancorada na data", () => {
    assert.equal(regraDaRepeticao("semanal", "2026-11-27"), "FREQ=WEEKLY;BYDAY=FR");
    assert.equal(regraDaRepeticao("mensal", "2026-12-05"), "FREQ=MONTHLY;BYMONTHDAY=5");
    assert.equal(regraDaRepeticao("dias_uteis", HOJE), "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    assert.equal(regraDaRepeticao("nenhuma", HOJE), null);
  });
  test("reconhece a opção de volta, inclusive regras do quick-add", () => {
    for (const r of ["nenhuma", "diaria", "semanal", "dias_uteis", "mensal", "anual"] as const) {
      assert.equal(repeticaoDaRegra(regraDaRepeticao(r, HOJE), HOJE), r);
    }
    assert.equal(repeticaoDaRegra("FREQ=WEEKLY", HOJE), "semanal");
    assert.equal(repeticaoDaRegra("FREQ=MONTHLY", HOJE), "mensal");
    assert.equal(repeticaoDaRegra("FREQ=WEEKLY;BYDAY=MO,WE,FR", HOJE), "personalizada");
    assert.equal(repeticaoDaRegra("FREQ=DAILY;INTERVAL=2", HOJE), "personalizada");
    assert.equal(repeticaoDaRegra("FREQ=MONTHLY;BYMONTHDAY=5", HOJE), "personalizada");
  });
});
