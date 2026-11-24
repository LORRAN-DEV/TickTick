import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseQuickAdd } from "../parser/quick-add.ts";
import { concluir, dadosDoQuickAdd, filtrarInteligente, filtrarLista, INBOX_ID, ordenar, type Tarefa } from "./tarefas.ts";

const HOJE = "2026-11-24"; // terça
let n = 0;
const t = (p: Partial<Tarefa>): Tarefa => ({
  id: `t${String(++n).padStart(3, "0")}`, titulo: "x", status: "aberta", prioridade: 0, data: null, hora: null,
  rrule: null, tags: [], listaId: INBOX_ID, criadoEm: "", atualizadoEm: "", ...p,
});
const titulos = (ts: Tarefa[]) => ts.map((x) => x.titulo);

describe("listas inteligentes", () => {
  const ts = [
    t({ titulo: "atrasada", data: "2026-11-20" }),
    t({ titulo: "hoje", data: HOJE }),
    t({ titulo: "amanhã", data: "2026-11-25" }),
    t({ titulo: "daqui 6 dias", data: "2026-11-30" }),
    t({ titulo: "daqui 7 dias", data: "2026-12-01" }),
    t({ titulo: "sem data" }),
    t({ titulo: "feita", data: HOJE, status: "concluida", concluidaEm: "2026-11-24T10:00:00Z" }),
    t({ titulo: "não vou", status: "nao_vou_fazer", concluidaEm: "2026-11-24T11:00:00Z" }),
    t({ titulo: "apagada", data: HOJE, excluidoEm: "2026-11-24T09:00:00Z" }),
  ];
  test("Hoje: de hoje e atrasadas", () => assert.deepEqual(titulos(filtrarInteligente(ts, "hoje", HOJE)), ["atrasada", "hoje"]));
  test("Amanhã", () => assert.deepEqual(titulos(filtrarInteligente(ts, "amanha", HOJE)), ["amanhã"]));
  test("Próximos 7 dias: até hoje + 6, com atrasadas", () =>
    assert.deepEqual(titulos(filtrarInteligente(ts, "proximos7", HOJE)), ["atrasada", "hoje", "amanhã", "daqui 6 dias"]));
  test("Tudo: abertas, sem data no fim", () =>
    assert.deepEqual(titulos(filtrarInteligente(ts, "tudo", HOJE)), ["atrasada", "hoje", "amanhã", "daqui 6 dias", "daqui 7 dias", "sem data"]));
  test("Concluídas: concluídas e 'não vou fazer', mais recente primeiro", () =>
    assert.deepEqual(titulos(filtrarInteligente(ts, "concluidas", HOJE)), ["não vou", "feita"]));
  test("Lixeira: só as apagadas", () => assert.deepEqual(titulos(filtrarInteligente(ts, "lixeira", HOJE)), ["apagada"]));
  test("Lista comum: abertas daquela lista", () => {
    const outra = t({ titulo: "trabalho", listaId: "L1" });
    assert.deepEqual(titulos(filtrarLista([...ts, outra], "L1")), ["trabalho"]);
  });
});

test("ordem: hora, depois prioridade; dia inteiro depois das com hora", () => {
  const ts = [
    t({ titulo: "dia inteiro", data: HOJE }),
    t({ titulo: "15h baixa", data: HOJE, hora: "15:00", prioridade: 1 }),
    t({ titulo: "15h alta", data: HOJE, hora: "15:00", prioridade: 3 }),
    t({ titulo: "9h", data: HOJE, hora: "09:00" }),
  ];
  assert.deepEqual(titulos(ordenar(ts)), ["9h", "15h alta", "15h baixa", "dia inteiro"]);
});

describe("concluir", () => {
  const agora = "2026-11-24T13:00:00.000Z";
  test("tarefa comum fica concluída", () => {
    const r = concluir(t({ data: HOJE }), agora, HOJE);
    assert.equal(r.tarefa.status, "concluida");
    assert.equal(r.tarefa.concluidaEm, agora);
    assert.equal(r.copiaConcluida, null);
  });
  test("recorrente avança e guarda cópia concluída da ocorrência", () => {
    const orig = t({ titulo: "academia", data: "2026-11-23", hora: "07:00", rrule: "FREQ=WEEKLY;BYDAY=MO" });
    const r = concluir(orig, agora, HOJE);
    assert.equal(r.tarefa.status, "aberta");
    assert.equal(r.tarefa.data, "2026-11-30");
    assert.equal(r.tarefa.id, orig.id);
    assert.ok(r.copiaConcluida);
    assert.equal(r.copiaConcluida.data, "2026-11-23");
    assert.equal(r.copiaConcluida.status, "concluida");
    assert.equal(r.copiaConcluida.rrule, null);
    assert.equal(r.copiaConcluida.origemId, orig.id);
    assert.ok(!("id" in r.copiaConcluida));
  });
  test("'não vou fazer' numa recorrente pula a ocorrência", () => {
    const r = concluir(t({ data: HOJE, rrule: "FREQ=DAILY" }), agora, HOJE, "nao_vou_fazer");
    assert.equal(r.tarefa.data, "2026-11-25");
    assert.equal(r.copiaConcluida!.status, "nao_vou_fazer");
  });
  test("regra não suportada: só conclui, não inventa data", () => {
    const r = concluir(t({ data: HOJE, rrule: "FREQ=MONTHLY;BYDAY=1MO" }), agora, HOJE);
    assert.equal(r.tarefa.status, "concluida");
    assert.equal(r.copiaConcluida, null);
  });
});

test("dados do quick-add", () => {
  const p = parseQuickAdd("pagar boleto amanhã 15h !alta #casa", { now: new Date("2026-11-24T13:00:00Z"), timeZone: "America/Sao_Paulo" });
  assert.deepEqual(dadosDoQuickAdd(p), { titulo: "pagar boleto", data: "2026-11-25", hora: "15:00", rrule: null, prioridade: 3, tags: ["casa"] });
});
