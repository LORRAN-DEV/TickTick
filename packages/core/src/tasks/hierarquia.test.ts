import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { itensDaTarefa, progressoChecklist, type ItemChecklist } from "./checklist.ts";
import {
  concluirComDescendentes,
  descendentes,
  filhas,
  lixeiraComDescendentes,
  moverDescendentesDeLista,
  nivel,
  NIVEL_MAXIMO,
  podeTerSubtarefa,
  progressoSubtarefas,
  restaurarComDescendentes,
} from "./hierarquia.ts";
import { filtrarInteligente, filtrarLista, INBOX_ID, type Tarefa } from "./tarefas.ts";

const HOJE = "2026-11-24";
const AGORA = "2026-11-24T13:00:00.000Z";
const t = (id: string, p: Partial<Tarefa> = {}): Tarefa => ({
  id, titulo: id, status: "aberta", prioridade: 0, data: null, hora: null, rrule: null, tags: [],
  listaId: INBOX_ID, criadoEm: "", atualizadoEm: "", ...p,
});
// mae → f1 (com data hoje) → n1 ; mae → f2 (concluída)
const base = (): Tarefa[] => [
  t("mae", { data: HOJE }),
  t("f1", { paiId: "mae", data: HOJE }),
  t("f2", { paiId: "mae", status: "concluida", concluidaEm: AGORA }),
  t("n1", { paiId: "f1" }),
  t("solta"),
];
const porId = (ts: Tarefa[]) => new Map(ts.map((x) => [x.id, x]));

describe("estrutura", () => {
  test("filhas, descendentes, nível e progresso", () => {
    const ts = base();
    assert.deepEqual(filhas(ts, "mae").map((x) => x.id), ["f1", "f2"]);
    assert.deepEqual(descendentes(ts, "mae").map((x) => x.id).sort(), ["f1", "f2", "n1"]);
    assert.equal(nivel(ts, ts.find((x) => x.id === "n1")!), 3);
    assert.deepEqual(progressoSubtarefas(ts, "mae"), { feitas: 1, total: 2 });
  });
  test("até 5 níveis", () => {
    const ts = [t("1"), t("2", { paiId: "1" }), t("3", { paiId: "2" }), t("4", { paiId: "3" }), t("5", { paiId: "4" })];
    assert.equal(NIVEL_MAXIMO, 5);
    assert.equal(podeTerSubtarefa(ts, ts[3]!), true);
    assert.equal(podeTerSubtarefa(ts, ts[4]!), false);
  });
  test("ciclo nos dados não trava", () => {
    const ts = [t("a", { paiId: "b" }), t("b", { paiId: "a" })];
    assert.equal(descendentes(ts, "a").length, 1);
    assert.ok(nivel(ts, ts[0]!) <= 2);
  });
});

describe("listas", () => {
  test("subtarefas ficam fora de Tudo e das listas comuns", () => {
    const ts = base();
    assert.deepEqual(filtrarInteligente(ts, "tudo", HOJE).map((x) => x.id), ["mae", "solta"]);
    assert.deepEqual(filtrarLista(ts, INBOX_ID).map((x) => x.id), ["mae", "solta"]);
  });
  test("subtarefa com data aparece em Hoje", () => {
    assert.deepEqual(filtrarInteligente(base(), "hoje", HOJE).map((x) => x.id), ["f1", "mae"].sort());
  });
});

describe("cascatas", () => {
  test("concluir a mãe conclui as abertas; as já feitas ficam como estão", () => {
    const r = concluirComDescendentes(base(), "mae", AGORA, HOJE);
    const m = porId(r.alteradas);
    assert.deepEqual([...m.keys()].sort(), ["f1", "mae", "n1"]);
    assert.ok([...m.values()].every((x) => x.status === "concluida" && x.concluidaEm === AGORA));
    assert.deepEqual(r.novas, []);
  });
  test("'não vou fazer' passa o mesmo status para as filhas", () => {
    const r = concluirComDescendentes(base(), "mae", AGORA, HOJE, "nao_vou_fazer");
    assert.ok(r.alteradas.every((x) => x.status === "nao_vou_fazer"));
  });
  test("mãe recorrente avança, reabre as filhas e pede para reiniciar checklists", () => {
    const ts = base().map((x) => (x.id === "mae" ? { ...x, rrule: "FREQ=DAILY" } : x));
    const r = concluirComDescendentes(ts, "mae", AGORA, HOJE);
    const m = porId(r.alteradas);
    assert.equal(m.get("mae")!.data, "2026-11-25");
    assert.equal(m.get("f2")!.status, "aberta");
    assert.equal(m.get("f2")!.concluidaEm, undefined);
    assert.equal(r.novas.length, 1);
    assert.deepEqual(r.reiniciarChecklistDe.sort(), ["f1", "f2", "mae", "n1"]);
  });
  test("lixeira leva as filhas; restaurar traz só as que foram junto", () => {
    let ts = base().map((x) => (x.id === "n1" ? { ...x, excluidoEm: "2026-11-01T00:00:00.000Z" } : x));
    const lix = lixeiraComDescendentes(ts, "mae", AGORA);
    assert.deepEqual(lix.map((x) => x.id).sort(), ["f1", "f2", "mae"]);
    ts = ts.map((x) => porId(lix).get(x.id) ?? x);
    assert.deepEqual(filtrarInteligente(ts, "lixeira", HOJE).map((x) => x.id), ["mae"]);
    const rest = restaurarComDescendentes(ts, "mae", "2026-11-24T14:00:00.000Z");
    assert.deepEqual(rest.map((x) => x.id).sort(), ["f1", "f2", "mae"]);
    assert.ok(rest.every((x) => x.excluidoEm === undefined));
  });
  test("mudar a mãe de lista leva as descendentes", () => {
    const m = moverDescendentesDeLista(base(), "mae", "L2", AGORA);
    assert.deepEqual(m.map((x) => x.id).sort(), ["f1", "f2", "n1"]);
    assert.ok(m.every((x) => x.listaId === "L2"));
  });
});

test("checklist: itens ativos na ordem e progresso", () => {
  const i = (id: string, p: Partial<ItemChecklist> = {}): ItemChecklist => ({
    id, tarefaId: "mae", titulo: id, feito: false, ordem: id, criadoEm: "", atualizadoEm: "", ...p,
  });
  const itens = [i("b", { feito: true }), i("a"), i("c", { excluidoEm: AGORA }), i("x", { tarefaId: "outra" })];
  assert.deepEqual(itensDaTarefa(itens, "mae").map((x) => x.id), ["a", "b"]);
  assert.deepEqual(progressoChecklist(itens, "mae"), { feitas: 1, total: 2 });
});
