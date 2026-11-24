/**
 * Subtarefas: uma subtarefa é uma Tarefa com `paiId`. Até 5 níveis, como no TickTick.
 * As operações em cascata devolvem as tarefas alteradas; quem chama grava.
 */
import type { PlainDate } from "../parser/dates.ts";
import { concluir, type StatusTarefa, type Tarefa } from "./tarefas.ts";

export const NIVEL_MAXIMO = 5;

/** Filhas diretas, sem as da lixeira, na ordem de criação. */
export function filhas(tarefas: Tarefa[], id: string): Tarefa[] {
  return tarefas.filter((t) => t.paiId === id && !t.excluidoEm).sort((a, b) => a.id.localeCompare(b.id));
}

/** Todas as descendentes (filhas, netas...), inclusive as da lixeira. Protegido contra ciclos. */
export function descendentes(tarefas: Tarefa[], id: string): Tarefa[] {
  const porPai = new Map<string, Tarefa[]>();
  for (const t of tarefas) if (t.paiId) porPai.set(t.paiId, [...(porPai.get(t.paiId) ?? []), t]);
  const vistos = new Set<string>([id]);
  const fila = [id];
  const out: Tarefa[] = [];
  while (fila.length) {
    for (const f of porPai.get(fila.shift()!) ?? []) {
      if (vistos.has(f.id)) continue;
      vistos.add(f.id);
      out.push(f);
      fila.push(f.id);
    }
  }
  return out;
}

/** Nível da tarefa: 1 = sem mãe, 2 = subtarefa, ... */
export function nivel(tarefas: Tarefa[], t: Tarefa): number {
  const porId = new Map(tarefas.map((x) => [x.id, x]));
  let n = 1;
  let atual = t;
  const vistos = new Set([t.id]);
  while (atual.paiId) {
    const pai = porId.get(atual.paiId);
    if (!pai || vistos.has(pai.id)) break;
    vistos.add(pai.id);
    atual = pai;
    n++;
  }
  return n;
}

export const podeTerSubtarefa = (tarefas: Tarefa[], t: Tarefa): boolean => nivel(tarefas, t) < NIVEL_MAXIMO;

/** Progresso das filhas diretas: feitas = concluídas ou "não vou fazer". */
export function progressoSubtarefas(tarefas: Tarefa[], id: string): { feitas: number; total: number } {
  const fs = filhas(tarefas, id);
  return { feitas: fs.filter((f) => f.status !== "aberta").length, total: fs.length };
}

export interface ResultadoCascata {
  alteradas: Tarefa[];
  /** Cópias concluídas de recorrentes (precisam de id novo). */
  novas: Array<Omit<Tarefa, "id">>;
  /** Tarefas cujo checklist deve voltar a ficar todo aberto (recorrente que avançou). */
  reiniciarChecklistDe: string[];
}

/**
 * Concluir (ou "não vou fazer") com as subtarefas:
 * - tarefa comum: as descendentes abertas recebem o mesmo status;
 * - recorrente que avançou: as descendentes reabrem e os checklists reiniciam, para a próxima ocorrência.
 */
export function concluirComDescendentes(
  tarefas: Tarefa[],
  id: string,
  agoraISO: string,
  hoje: PlainDate,
  como: Exclude<StatusTarefa, "aberta"> = "concluida",
): ResultadoCascata {
  const t = tarefas.find((x) => x.id === id);
  if (!t || t.status !== "aberta" || t.excluidoEm) return { alteradas: [], novas: [], reiniciarChecklistDe: [] };
  const r = concluir(t, agoraISO, hoje, como);
  const desc = descendentes(tarefas, id).filter((d) => !d.excluidoEm);
  if (r.copiaConcluida) {
    const reabertas = desc
      .filter((d) => d.status !== "aberta")
      .map((d) => ({ ...d, status: "aberta" as const, concluidaEm: undefined, atualizadoEm: agoraISO }));
    return { alteradas: [r.tarefa, ...reabertas], novas: [r.copiaConcluida], reiniciarChecklistDe: [id, ...desc.map((d) => d.id)] };
  }
  const fechadas = desc
    .filter((d) => d.status === "aberta")
    .map((d) => ({ ...d, status: como, concluidaEm: agoraISO, atualizadoEm: agoraISO }));
  return { alteradas: [r.tarefa, ...fechadas], novas: [], reiniciarChecklistDe: [] };
}

/** Lixeira com as descendentes que ainda não estavam lá (mesmo instante, para restaurar junto). */
export function lixeiraComDescendentes(tarefas: Tarefa[], id: string, agoraISO: string): Tarefa[] {
  const t = tarefas.find((x) => x.id === id);
  if (!t || t.excluidoEm) return [];
  return [t, ...descendentes(tarefas, id).filter((d) => !d.excluidoEm)].map((x) => ({
    ...x,
    excluidoEm: agoraISO,
    atualizadoEm: agoraISO,
  }));
}

/** Restaura a tarefa e as descendentes que foram para a lixeira junto com ela. */
export function restaurarComDescendentes(tarefas: Tarefa[], id: string, agoraISO: string): Tarefa[] {
  const t = tarefas.find((x) => x.id === id);
  if (!t?.excluidoEm) return [];
  const junto = descendentes(tarefas, id).filter((d) => d.excluidoEm === t.excluidoEm);
  return [t, ...junto].map((x) => ({ ...x, excluidoEm: undefined, atualizadoEm: agoraISO }));
}

/** Leva as descendentes para a lista da mãe. */
export function moverDescendentesDeLista(tarefas: Tarefa[], id: string, listaId: string, agoraISO: string): Tarefa[] {
  return descendentes(tarefas, id)
    .filter((d) => d.listaId !== listaId)
    .map((d) => ({ ...d, listaId, atualizadoEm: agoraISO }));
}
