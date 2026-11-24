import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ItemChecklist, Lista, Tarefa } from "@ticktick/core";
import { listarItens } from "./checklist";
import { garantirInbox, listarListas, listarTarefas } from "./tarefas";

const VAZIO: never[] = [];

/** Tarefas (inclusive lixeira), listas e itens de checklist, atualizados a cada gravação no banco local. */
export function useTarefas(): {
  tarefas: Tarefa[];
  listas: Lista[];
  itens: ItemChecklist[];
  carregando: boolean;
} {
  useEffect(() => {
    garantirInbox().catch((e) => console.error("Falha ao criar a Inbox", e));
  }, []);
  const tarefas = useLiveQuery(() => listarTarefas(), []);
  const listas = useLiveQuery(() => listarListas(), []);
  const itens = useLiveQuery(() => listarItens(), []);
  return {
    tarefas: tarefas ?? VAZIO,
    listas: listas ?? VAZIO,
    itens: itens ?? VAZIO,
    carregando: tarefas === undefined || listas === undefined || itens === undefined,
  };
}
