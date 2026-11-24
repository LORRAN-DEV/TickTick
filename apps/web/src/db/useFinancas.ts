import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Meta, Mov } from "@ticktick/core";
import { listarMetas, listarMovs, semearSeNecessario } from "./financas";

const VAZIO: never[] = [];

/** Movimentações e metas ativas, atualizadas sozinhas a cada gravação no banco local. */
export function useFinancas(): { movs: Mov[]; metas: Meta[]; carregando: boolean } {
  useEffect(() => {
    semearSeNecessario().catch((e) => console.error("Falha ao gravar exemplos", e));
  }, []);
  const movs = useLiveQuery(() => listarMovs(), []);
  const metas = useLiveQuery(() => listarMetas(), []);
  return {
    movs: movs ?? VAZIO,
    metas: metas ?? VAZIO,
    carregando: movs === undefined || metas === undefined,
  };
}
