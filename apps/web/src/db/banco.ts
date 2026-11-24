/**
 * Banco local do app (IndexedDB via Dexie). Um banco só, com uma tabela por entidade.
 *
 * Toda leitura e escrita da tela passa pelas funções de `src/db/`; nada depende de rede.
 * Regras de dados do plano, para o sync futuro: id UUID v7 gerado no aparelho,
 * criadoEm/atualizadoEm em ISO e exclusão lógica (excluidoEm) em vez de apagar.
 *
 * Mudou o esquema? Acrescente uma nova `version(n)`; nunca altere as anteriores,
 * senão quem já tem dados no navegador quebra.
 */
import Dexie, { type EntityTable } from "dexie";
import type { ItemChecklist, Lista, Meta, Mov, Tarefa } from "@ticktick/core";

export type Config = { chave: string; valor: unknown };

export class TickTickDB extends Dexie {
  movs!: EntityTable<Mov, "id">;
  metas!: EntityTable<Meta, "id">;
  config!: EntityTable<Config, "chave">;
  tarefas!: EntityTable<Tarefa, "id">;
  listas!: EntityTable<Lista, "id">;
  itensChecklist!: EntityTable<ItemChecklist, "id">;

  constructor(nome = "ticktick") {
    super(nome);
    this.version(1).stores({
      movs: "id, data, tipo, status, atualizadoEm",
      metas: "id, atualizadoEm",
      config: "chave",
    });
    this.version(2).stores({
      tarefas: "id, listaId, status, data, atualizadoEm",
      listas: "id, nome, atualizadoEm",
    });
    this.version(3).stores({
      tarefas: "id, listaId, status, data, atualizadoEm, paiId",
      itensChecklist: "id, tarefaId, atualizadoEm",
    });
  }
}

export const db = new TickTickDB();

export const agoraISO = (): string => new Date().toISOString();
export const ativo = (x: { excluidoEm?: string | undefined }): boolean => !x.excluidoEm;
