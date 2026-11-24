/** Checklist dentro de uma tarefa: itens de texto marcáveis (tabela `checklist_items` do plano). */

export interface ItemChecklist {
  id: string;
  tarefaId: string;
  titulo: string;
  feito: boolean;
  /** Ordem de exibição (texto comparável; hoje, o próprio id v7, que segue a criação). */
  ordem: string;
  criadoEm: string;
  atualizadoEm: string;
  excluidoEm?: string | undefined;
}

/** Itens ativos de uma tarefa, na ordem. */
export function itensDaTarefa(itens: ItemChecklist[], tarefaId: string): ItemChecklist[] {
  return itens
    .filter((i) => i.tarefaId === tarefaId && !i.excluidoEm)
    .sort((a, b) => a.ordem.localeCompare(b.ordem) || a.id.localeCompare(b.id));
}

export function progressoChecklist(itens: ItemChecklist[], tarefaId: string): { feitas: number; total: number } {
  const its = itensDaTarefa(itens, tarefaId);
  return { feitas: its.filter((i) => i.feito).length, total: its.length };
}
