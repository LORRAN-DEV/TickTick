import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import {
  filtrarInteligente,
  progressoChecklist,
  progressoSubtarefas,
  type Tarefa,
} from "@ticktick/core";
import { TickTickDB } from "@/db/banco";
import {
  adicionarItem,
  alternarItem,
  listarItens,
  removerItem,
  renomearItem,
} from "@/db/checklist";
import {
  atualizarTarefa,
  concluirTarefa,
  criarDoTexto,
  criarSubtarefa,
  listarTarefas,
  moverParaLixeira,
  NivelMaximoError,
  restaurarTarefa,
  TituloVazioError,
} from "@/db/tarefas";

const AGORA = new Date(2026, 10, 24, 10, 0); // terça
const HOJE = "2026-11-24";
let nome: string;
let banco: TickTickDB;
const reabrir = () => {
  banco.close();
  banco = new TickTickDB(nome);
};
const criar = (texto: string) => criarDoTexto(texto, { agora: AGORA, banco });
const sub = (pai: string, texto: string) => criarSubtarefa(pai, texto, { agora: AGORA, banco });
const buscar = async (id: string) => (await listarTarefas(banco)).find((t) => t.id === id)!;

beforeEach(() => {
  nome = `teste-${crypto.randomUUID()}`;
  banco = new TickTickDB(nome);
});
afterEach(async () => {
  await banco.delete();
});

describe("subtarefas", () => {
  it("criada pelo quick-add, na lista da mãe, mesmo com ~outra", async () => {
    const mae = await criar("pintar a sala ~casa");
    const f = await sub(mae.id, "comprar tinta amanhã !alta ~trabalho");
    reabrir();
    expect(await buscar(f.id)).toMatchObject({
      titulo: "comprar tinta",
      paiId: mae.id,
      listaId: mae.listaId,
      prioridade: 3,
      data: "2026-11-25",
    });
    const ts = await listarTarefas(banco);
    expect(progressoSubtarefas(ts, mae.id)).toEqual({ feitas: 0, total: 1 });
    expect(filtrarInteligente(ts, "tudo", HOJE).map((t) => t.id)).toEqual([mae.id]);
    expect(filtrarInteligente(ts, "amanha", HOJE).map((t) => t.id)).toEqual([f.id]);
  });

  it("vai até o 5º nível", async () => {
    let atual: Tarefa = await criar("nível 1");
    for (let n = 2; n <= 5; n++) atual = await sub(atual.id, `nível ${n}`);
    await expect(sub(atual.id, "nível 6")).rejects.toBeInstanceOf(NivelMaximoError);
    await expect(sub(atual.id, "  ")).rejects.toBeInstanceOf(TituloVazioError);
  });

  it("concluir a mãe conclui as filhas abertas", async () => {
    const mae = await criar("mudança");
    const a = await sub(mae.id, "caixas");
    const b = await sub(a.id, "fita");
    await concluirTarefa(mae.id, "concluida", banco, AGORA);
    for (const id of [mae.id, a.id, b.id]) expect((await buscar(id)).status).toBe("concluida");
  });

  it("lixeira leva as filhas e restaurar traz de volta", async () => {
    const mae = await criar("viagem");
    const a = await sub(mae.id, "passagem");
    await moverParaLixeira(mae.id, banco);
    let ts = await listarTarefas(banco);
    expect(filtrarInteligente(ts, "lixeira", HOJE).map((t) => t.id)).toEqual([mae.id]);
    expect((await buscar(a.id)).excluidoEm).toBeTruthy();
    await restaurarTarefa(mae.id, banco);
    ts = await listarTarefas(banco);
    expect(ts.every((t) => !t.excluidoEm)).toBe(true);
  });

  it("mudar a mãe de lista leva as filhas", async () => {
    const mae = await criar("projeto");
    const a = await sub(mae.id, "etapa 1");
    const outra = await criar("x ~trabalho");
    await atualizarTarefa(mae.id, { listaId: outra.listaId }, banco);
    expect((await buscar(a.id)).listaId).toBe(outra.listaId);
  });

  it("mãe recorrente: avança, reabre filhas e reinicia o checklist", async () => {
    const mae = await criar("faxina todo dia");
    const a = await sub(mae.id, "lavar louça");
    const item = await adicionarItem(mae.id, "varrer", banco);
    await concluirTarefa(a.id, "concluida", banco, AGORA);
    await alternarItem(item.id, banco);
    await concluirTarefa(mae.id, "concluida", banco, AGORA);
    expect(await buscar(mae.id)).toMatchObject({ status: "aberta", data: "2026-11-25" });
    expect((await buscar(a.id)).status).toBe("aberta");
    expect((await listarItens(banco))[0]!.feito).toBe(false);
  });
});

describe("checklist", () => {
  it("adicionar, marcar, renomear e remover persistem", async () => {
    const t = await criar("mala");
    const i1 = await adicionarItem(t.id, "  carregador ", banco);
    const i2 = await adicionarItem(t.id, "escova", banco);
    await alternarItem(i1.id, banco);
    await renomearItem(i2.id, "escova de dentes", banco);
    reabrir();
    let itens = await listarItens(banco);
    expect(itens.map((i) => [i.titulo, i.feito])).toEqual([
      ["carregador", true],
      ["escova de dentes", false],
    ]);
    expect(progressoChecklist(itens, t.id)).toEqual({ feitas: 1, total: 2 });
    await expect(renomearItem(i2.id, " ", banco)).rejects.toBeInstanceOf(TituloVazioError);
    await expect(adicionarItem(t.id, "", banco)).rejects.toBeInstanceOf(TituloVazioError);
    await removerItem(i1.id, banco);
    itens = await listarItens(banco);
    expect(itens.map((i) => i.titulo)).toEqual(["escova de dentes"]);
    expect((await banco.itensChecklist.get(i1.id))!.excluidoEm).toBeTruthy();
  });
});

it("atualização do esquema v2 → v3 mantém tarefas e finanças", async () => {
  banco.close();
  await banco.delete();
  const v2 = new Dexie(nome);
  v2.version(1).stores({
    movs: "id, data, tipo, status, atualizadoEm",
    metas: "id, atualizadoEm",
    config: "chave",
  });
  v2.version(2).stores({
    tarefas: "id, listaId, status, data, atualizadoEm",
    listas: "id, nome, atualizadoEm",
  });
  await v2
    .table("tarefas")
    .add({ id: "t1", titulo: "antiga", status: "aberta", listaId: "inbox", tags: [] });
  await v2.table("movs").add({ id: "m1", valor: 10 });
  v2.close();
  banco = new TickTickDB(nome);
  expect(await banco.tarefas.get("t1")).toMatchObject({ titulo: "antiga" });
  expect(await banco.movs.get("m1")).toMatchObject({ valor: 10 });
  const f = await sub("t1", "nova filha");
  expect(await banco.tarefas.where("paiId").equals("t1").count()).toBe(1);
  expect(f.paiId).toBe("t1");
});
