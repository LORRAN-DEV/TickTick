import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { filtrarInteligente, filtrarLista, INBOX_ID } from "@ticktick/core";
import { TickTickDB } from "@/db/banco";
import {
  concluirTarefa,
  criarDoTexto,
  listarListas,
  listarTarefas,
  moverParaLixeira,
  reabrirTarefa,
  restaurarTarefa,
  TituloVazioError,
  atualizarTarefa,
} from "@/db/tarefas";

// Terça, 24/11/2026, 10:00 no horário local do teste.
const AGORA = new Date(2026, 10, 24, 10, 0);
const HOJE = "2026-11-24";
let nome: string;
let banco: TickTickDB;
const reabrir = () => {
  banco.close();
  banco = new TickTickDB(nome);
};
const criar = (texto: string, listaPadrao?: string) =>
  criarDoTexto(texto, { agora: AGORA, banco, ...(listaPadrao ? { listaPadrao } : {}) });

beforeEach(() => {
  nome = `teste-${crypto.randomUUID()}`;
  banco = new TickTickDB(nome);
});
afterEach(async () => {
  await banco.delete();
});

describe("tarefas no banco local", () => {
  it("quick-add vira tarefa completa na Inbox e persiste", async () => {
    await criar("pagar boleto amanhã 15h !alta #casa");
    reabrir();
    const [t] = await listarTarefas(banco);
    expect(t).toMatchObject({
      titulo: "pagar boleto",
      data: "2026-11-25",
      hora: "15:00",
      prioridade: 3,
      tags: ["casa"],
      listaId: INBOX_ID,
      status: "aberta",
    });
    expect(t!.id).toMatch(/^[0-9a-f-]{14}7/);
    expect((await listarListas(banco)).map((l) => l.nome)).toEqual(["Inbox"]);
  });

  it("~lista cria a lista uma vez e reaproveita (sem diferenciar maiúsculas)", async () => {
    await criar("reunião quinta 15h ~trabalho");
    await criar("relatório ~Trabalho");
    const listas = await listarListas(banco);
    expect(listas.map((l) => l.nome)).toEqual(["Inbox", "trabalho"]);
    const ts = await listarTarefas(banco);
    expect(filtrarLista(ts, listas[1]!.id)).toHaveLength(2);
  });

  it("sem ~lista usa a lista aberta na tela", async () => {
    await criar("algo", "L-123");
    expect((await listarTarefas(banco))[0]!.listaId).toBe("L-123");
  });

  it("título vazio é recusado", async () => {
    await expect(criar("amanhã 15h")).rejects.toBeInstanceOf(TituloVazioError);
    expect(await listarTarefas(banco)).toEqual([]);
  });

  it("concluir e reabrir", async () => {
    const t = await criar("ligar pro banco hoje");
    await concluirTarefa(t.id, "concluida", banco, AGORA);
    reabrir();
    let ts = await listarTarefas(banco);
    expect(filtrarInteligente(ts, "hoje", HOJE)).toEqual([]);
    expect(filtrarInteligente(ts, "concluidas", HOJE).map((x) => x.titulo)).toEqual([
      "ligar pro banco",
    ]);
    await reabrirTarefa(t.id, banco);
    ts = await listarTarefas(banco);
    expect(filtrarInteligente(ts, "hoje", HOJE).map((x) => x.titulo)).toEqual(["ligar pro banco"]);
    expect(ts[0]!.concluidaEm).toBeUndefined();
  });

  it("recorrente: concluir avança para a próxima segunda e guarda cópia concluída", async () => {
    const t = await criar("academia toda segunda 7h"); // próxima segunda: 30/11
    expect(t.data).toBe("2026-11-30");
    await concluirTarefa(t.id, "concluida", banco, AGORA);
    const ts = await listarTarefas(banco);
    expect(ts).toHaveLength(2);
    expect(ts.find((x) => x.id === t.id)).toMatchObject({ status: "aberta", data: "2026-12-07" });
    expect(filtrarInteligente(ts, "concluidas", HOJE)[0]).toMatchObject({
      titulo: "academia",
      data: "2026-11-30",
      origemId: t.id,
      rrule: null,
    });
  });

  it("concluir duas vezes seguidas uma tarefa comum não duplica nada", async () => {
    const t = await criar("uma vez");
    await Promise.all([
      concluirTarefa(t.id, "concluida", banco, AGORA),
      concluirTarefa(t.id, "concluida", banco, AGORA),
    ]);
    expect(await listarTarefas(banco)).toHaveLength(1);
  });

  it("lixeira e restaurar persistem", async () => {
    const t = await criar("apagar isso hoje");
    await moverParaLixeira(t.id, banco);
    reabrir();
    let ts = await listarTarefas(banco);
    expect(filtrarInteligente(ts, "hoje", HOJE)).toEqual([]);
    expect(filtrarInteligente(ts, "lixeira", HOJE)).toHaveLength(1);
    await restaurarTarefa(t.id, banco);
    ts = await listarTarefas(banco);
    expect(filtrarInteligente(ts, "lixeira", HOJE)).toEqual([]);
    expect(ts[0]!.excluidoEm).toBeUndefined();
  });

  it("editar persiste, atualiza atualizadoEm e recusa título vazio sem gravar", async () => {
    const t = await criar("pagar boleto amanhã 15h");
    const depois = new Date(2026, 10, 24, 11, 0);
    await atualizarTarefa(
      t.id,
      { titulo: "pagar conta de luz", prioridade: 2, tags: ["casa"] },
      banco,
      depois,
    );
    reabrir();
    const salva = (await listarTarefas(banco))[0]!;
    expect(salva).toMatchObject({
      titulo: "pagar conta de luz",
      prioridade: 2,
      tags: ["casa"],
      hora: "15:00",
    });
    expect(salva.atualizadoEm).toBe(depois.toISOString());
    await expect(atualizarTarefa(t.id, { titulo: " " }, banco)).rejects.toBeInstanceOf(
      TituloVazioError,
    );
    expect((await listarTarefas(banco))[0]!.titulo).toBe("pagar conta de luz");
  });

  it("atualização do esquema v1 → v2 mantém as finanças de quem já usava o app", async () => {
    banco.close();
    await banco.delete();
    const v1 = new Dexie(nome);
    v1.version(1).stores({
      movs: "id, data, tipo, status, atualizadoEm",
      metas: "id, atualizadoEm",
      config: "chave",
    });
    await v1
      .table("movs")
      .add({ id: "m1", data: HOJE, tipo: "Despesa", valor: 10, status: "pago" });
    v1.close();
    banco = new TickTickDB(nome);
    expect(await banco.movs.get("m1")).toMatchObject({ valor: 10 });
    await criar("nova tarefa");
    expect(await listarTarefas(banco)).toHaveLength(1);
  });
});
