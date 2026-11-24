import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Lista, Tarefa } from "@ticktick/core";
import { garantirInbox, listarListas, listarTarefas } from "./tarefas";

const VAZIO: never[] = [];

/** Tarefas (inclusive lixeira) e listas, atualizadas sozinhas a cada gravação no banco local. */
export function useTarefas(): { tarefas: Tarefa[]; listas: Lista[]; carregando: boolean } {
  useEffect(() => {
    garantirInbox().catch((e) => console.error("Falha ao criar a Inbox", e));
  }, []);
  const tarefas = useLiveQuery(() => listarTarefas(), []);
  const listas = useLiveQuery(() => listarListas(), []);
  return {
    tarefas: tarefas ?? VAZIO,
    listas: listas ?? VAZIO,
    carregando: tarefas === undefined || listas === undefined,
  };
}
