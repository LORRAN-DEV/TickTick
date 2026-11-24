import assert from "node:assert/strict";
import { test } from "node:test";
import { alternarLembrete, descreverLembrete, LEMBRETES_PRONTOS, normalizarLembretes } from "./lembretes.ts";
import { editarTarefa } from "./edicao.ts";
import { INBOX_ID, type Tarefa } from "./tarefas.ts";

test("descrição de cada opção pronta", () => {
  assert.deepEqual(LEMBRETES_PRONTOS.map(descreverLembrete), [
    "na hora", "5 min antes", "15 min antes", "30 min antes", "1 h antes", "1 dia antes",
  ]);
  assert.equal(descreverLembrete(120), "2 h antes");
  assert.equal(descreverLembrete(2880), "2 dias antes");
});

test("normalizar: inteiros de 0 a 7 dias, sem repetir, em ordem", () => {
  assert.deepEqual(normalizarLembretes([{ antes: 15 }, { antes: 0 }, { antes: 15 }, { antes: -1 }, { antes: 1.5 }, null, {}, { antes: 99999 }]), [
    { antes: 0 },
    { antes: 15 },
  ]);
  assert.deepEqual(normalizarLembretes(undefined), []);
});

test("alternar liga e desliga", () => {
  const um = alternarLembrete([], 15);
  assert.deepEqual(um, [{ antes: 15 }]);
  assert.deepEqual(alternarLembrete([...um, { antes: 0 }], 15), [{ antes: 0 }]);
});

test("editar a tarefa normaliza os lembretes", () => {
  const t: Tarefa = {
    id: "t", titulo: "x", status: "aberta", prioridade: 0, data: "2026-11-24", hora: "10:00", rrule: null,
    tags: [], listaId: INBOX_ID, criadoEm: "", atualizadoEm: "",
  };
  const e = editarTarefa(t, { lembretes: [{ antes: 60 }, { antes: 0 }, { antes: 60 }] }, "2026-11-24T13:00:00Z", "2026-11-24");
  assert.deepEqual(e.lembretes, [{ antes: 0 }, { antes: 60 }]);
});
