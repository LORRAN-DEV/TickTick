import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TickTickDB } from "@/db/banco";
import { MARCA_REMOTA, camposAlterados, type EntradaFila } from "@/db/sync/fila";
import {
  adicionarMov,
  alternarPago,
  aportarMeta,
  adicionarMeta,
  limparTudo,
  semearSeNecessario,
} from "@/db/financas";
import {
  atualizarTarefa,
  concluirTarefa,
  criarDoTexto,
  criarSubtarefa,
  moverParaLixeira,
  reabrirTarefa,
  restaurarTarefa,
} from "@/db/tarefas";
import { adicionarItem, alternarItem, removerItem, renomearItem } from "@/db/checklist";

const AGORA = new Date(2026, 10, 24, 10, 0);
let banco: TickTickDB;
beforeEach(() => {
  banco = new TickTickDB(`teste-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await banco.delete();
});

const fila = () => banco.fila.orderBy("seq").toArray();
const ultima = async () => (await fila()).at(-1)!;
const limpar = () => banco.fila.clear();

describe("camposAlterados", () => {
  it("só o que mudou; removido vira null; id nunca entra", () => {
    expect(
      camposAlterados({ id: "a", x: 1, y: [1], z: "k" }, { id: "a", x: 1, y: [1, 2] }),
    ).toEqual({
      y: [1, 2],
      z: null,
    });
    expect(camposAlterados(undefined, { id: "a", x: 1, u: undefined })).toEqual({ x: 1 });
  });
});

describe("toda gravação nas tabelas sincronizadas entra na fila, na mesma transação", () => {
  it("criar tarefa: registro inteiro (sem id)", async () => {
    const t = await criarDoTexto("pagar boleto amanhã 15h", { agora: AGORA, banco });
    const entradas = await fila();
    const daTarefa = entradas.find((e) => e.tabela === "tarefas")!;
    expect(daTarefa.registroId).toBe(t.id);
    expect(daTarefa.campos).toMatchObject({
      titulo: "pagar boleto",
      data: "2026-11-25",
      hora: "15:00",
      status: "aberta",
    });
    expect(daTarefa.campos).not.toHaveProperty("id");
    expect(entradas.some((e) => e.tabela === "listas" && e.registroId === "inbox")).toBe(true);
  });

  it("editar: só os campos alterados (update/put)", async () => {
    const t = await criarDoTexto("x", { agora: AGORA, banco });
    await limpar();
    await atualizarTarefa(t.id, { titulo: "y", prioridade: 2 }, banco);
    expect((await ultima()).campos).toEqual({
      titulo: "y",
      prioridade: 2,
      atualizadoEm: expect.any(String),
    });
  });

  it("reabrir remove concluidaEm → null; restaurar remove excluidoEm → null", async () => {
    const t = await criarDoTexto("x hoje", { agora: AGORA, banco });
    await concluirTarefa(t.id, "concluida", banco, AGORA);
    await limpar();
    await reabrirTarefa(t.id, banco);
    expect((await ultima()).campos).toMatchObject({ status: "aberta", concluidaEm: null });
    await moverParaLixeira(t.id, banco);
    await limpar();
    await restaurarTarefa(t.id, banco);
    expect((await ultima()).campos).toMatchObject({ excluidoEm: null });
  });

  it("cascatas (bulkPut) e subtarefas", async () => {
    const mae = await criarDoTexto("mãe", { agora: AGORA, banco });
    const f = await criarSubtarefa(mae.id, "filha", { agora: AGORA, banco });
    await limpar();
    await moverParaLixeira(mae.id, banco);
    const ids = (await fila()).map((e) => e.registroId).sort();
    expect(ids).toEqual([mae.id, f.id].sort());
  });

  it("modify (função) e modify em lote com filtro", async () => {
    const m = await adicionarMov(
      {
        data: "2026-11-10",
        tipo: "Despesa",
        descricao: "a",
        categoria: "Outros",
        contaId: "x",
        valor: 1,
        status: "pago",
      },
      banco,
    );
    const meta = await adicionarMeta({ nome: "n", alvo: 10, atual: 0 }, banco);
    await limpar();
    await alternarPago(m.id, banco);
    expect((await ultima()).campos).toMatchObject({ status: "pendente" });
    await aportarMeta(meta.id, 5, banco);
    expect((await ultima()).campos).toMatchObject({ atual: 5 });
    await limpar();
    await limparTudo(banco);
    expect((await fila()).map((e) => e.tabela).sort()).toEqual(["metas", "movs"]);
  });

  it("checklist", async () => {
    const t = await criarDoTexto("x", { agora: AGORA, banco });
    const i = await adicionarItem(t.id, "a", banco);
    await alternarItem(i.id, banco);
    await renomearItem(i.id, "b", banco);
    await removerItem(i.id, banco);
    const doItem = (await fila())
      .filter((e) => e.tabela === "itensChecklist")
      .map((e) => Object.keys(e.campos));
    expect(doItem).toEqual([
      expect.arrayContaining(["tarefaId", "titulo", "feito", "ordem"]),
      expect.arrayContaining(["feito"]),
      expect.arrayContaining(["titulo"]),
      expect.arrayContaining(["excluidoEm"]),
    ]);
  });

  it("concluir recorrente com reinício do checklist (modify com filtro em anyOf)", async () => {
    const t = await criarDoTexto("faxina todo dia", { agora: AGORA, banco });
    const i = await adicionarItem(t.id, "varrer", banco);
    await alternarItem(i.id, banco);
    await limpar();
    await concluirTarefa(t.id, "concluida", banco, AGORA);
    const tabelas = (await fila()).map((e) => e.tabela);
    expect(tabelas).toContain("itensChecklist"); // feito: false de volta
    expect(tabelas.filter((x) => x === "tarefas").length).toBe(2); // avançou + cópia concluída
  });

  it("exemplos semeados entram na fila", async () => {
    await semearSeNecessario(banco, AGORA);
    expect((await fila()).length).toBe(22);
  });

  it("gravar sem mudar nada não entra na fila", async () => {
    const t = await criarDoTexto("x", { agora: AGORA, banco });
    await limpar();
    await banco.tarefas.put({ ...(await banco.tarefas.get(t.id))! });
    expect(await fila()).toEqual([]);
  });

  it("gravação marcada como remota não entra na fila e a marca não é gravada", async () => {
    await banco.tarefas.put({ id: "r1", titulo: "do servidor", [MARCA_REMOTA]: true } as never);
    expect(await fila()).toEqual([]);
    expect(await banco.tarefas.get("r1")).toEqual({ id: "r1", titulo: "do servidor" });
  });

  it("se a gravação falha, a fila também não é gravada (mesma transação)", async () => {
    const t = await criarDoTexto("x", { agora: AGORA, banco });
    await limpar();
    await expect(
      banco.transaction("rw", banco.tarefas, async () => {
        await banco.tarefas.update(t.id, { titulo: "não deve ficar" });
        throw new Error("falhou depois");
      }),
    ).rejects.toThrow("falhou depois");
    expect(await fila()).toEqual([]);
    expect((await banco.tarefas.get(t.id))!.titulo).toBe("x");
  });

  it("tabelas não sincronizadas (config) não entram", async () => {
    await banco.config.put({ chave: "a", valor: 1 });
    expect(await fila()).toEqual([] as EntradaFila[]);
  });
});
