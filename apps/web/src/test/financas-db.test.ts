import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resumoMes } from "@ticktick/core";
import {
  adicionarMeta,
  adicionarMov,
  alternarPago,
  aportarMeta,
  excluirMeta,
  excluirMov,
  limparTudo,
  listarMetas,
  listarMovs,
  semearSeNecessario,
  type NovaMov,
} from "@/db/financas";
import { TickTickDB } from "@/db/banco";

// Cada teste usa um banco novo. "Reabrir" o banco simula recarregar a página.
let nome: string;
let banco: TickTickDB;
const reabrir = () => {
  banco.close();
  banco = new TickTickDB(nome);
};

beforeEach(() => {
  nome = `teste-${crypto.randomUUID()}`;
  banco = new TickTickDB(nome);
});
afterEach(async () => {
  await banco.delete();
});

const despesa: NovaMov = {
  data: "2026-11-10",
  tipo: "Despesa",
  descricao: "Padaria",
  categoria: "Alimentação",
  contaId: "Dinheiro",
  valor: 12.5,
  status: "pago",
};

describe("banco local das finanças", () => {
  it("movimentação continua depois de reabrir, com id v7 e datas", async () => {
    const m = await adicionarMov(despesa, banco);
    reabrir();
    const movs = await listarMovs(banco);
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ descricao: "Padaria", valor: 12.5 });
    expect(m.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(m.criadoEm).toBe(m.atualizadoEm);
    expect(resumoMes(movs, "2026-11").despesas).toBe(12.5);
  });

  it("alternar pago persiste e atualiza atualizadoEm", async () => {
    const m = await adicionarMov(despesa, banco);
    await new Promise((r) => setTimeout(r, 5));
    await alternarPago(m.id, banco);
    reabrir();
    const [salva] = await listarMovs(banco);
    expect(salva!.status).toBe("pendente");
    expect(salva!.atualizadoEm > m.atualizadoEm).toBe(true);
  });

  it("excluir é lógico: some da lista mas fica no banco marcado", async () => {
    const m = await adicionarMov(despesa, banco);
    await excluirMov(m.id, banco);
    reabrir();
    expect(await listarMovs(banco)).toEqual([]);
    expect((await banco.movs.get(m.id))!.excluidoEm).toBeTruthy();
  });

  it("metas: criar, aportar e excluir persistem", async () => {
    const meta = await adicionarMeta({ nome: "Notebook", alvo: 4000, atual: 0 }, banco);
    await aportarMeta(meta.id, 500, banco);
    await aportarMeta(meta.id, 100, banco);
    reabrir();
    expect((await listarMetas(banco))[0]!.atual).toBe(600);
    await excluirMeta(meta.id, banco);
    expect(await listarMetas(banco)).toEqual([]);
  });

  it("exemplos só na primeira abertura; depois de limpar não voltam", async () => {
    expect(await semearSeNecessario(banco, new Date(2026, 10, 24))).toBe(true);
    expect((await listarMovs(banco)).length).toBeGreaterThan(10);
    expect((await listarMetas(banco)).map((m) => m.nome)).toEqual([
      "Reserva de emergência",
      "Viagem de férias",
    ]);
    await limparTudo(banco);
    reabrir();
    expect(await semearSeNecessario(banco)).toBe(false);
    expect(await listarMovs(banco)).toEqual([]);
    expect(await listarMetas(banco)).toEqual([]);
  });

  it("duas aberturas ao mesmo tempo não duplicam os exemplos", async () => {
    await Promise.all([semearSeNecessario(banco), semearSeNecessario(banco)]);
    const n = (await listarMovs(banco)).length;
    expect(n).toBe(20);
  });
});
