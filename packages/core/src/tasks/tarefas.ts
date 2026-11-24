/**
 * Tarefas: modelo, listas inteligentes e regras de conclusão. Funções puras.
 *
 * Campos de sync iguais aos das finanças: id UUID v7, criadoEm/atualizadoEm (ISO) e
 * excluidoEm (exclusão lógica, que também é a Lixeira).
 */
import { addDays, type PlainDate } from "../parser/dates.ts";
import type { ParsedTask, Priority } from "../parser/quick-add.ts";
import { proximaOcorrencia } from "../recurrence/proxima.ts";
import type { Lembrete } from "./lembretes.ts";

export type StatusTarefa = "aberta" | "concluida" | "nao_vou_fazer";

export interface Tarefa {
  id: string;
  titulo: string;
  notas?: string | undefined;
  status: StatusTarefa;
  prioridade: Priority;
  /** Data local, ou null para tarefa sem data. */
  data: PlainDate | null;
  /** Hora local HH:MM, ou null para dia inteiro. */
  hora: string | null;
  /** RRULE sem DTSTART; a `data` é a ocorrência atual. */
  rrule: string | null;
  tags: string[];
  listaId: string;
  /** Tarefa-mãe, se esta for uma subtarefa. */
  paiId?: string | undefined;
  /** Lembretes em minutos antes da hora (ADR 0008). */
  lembretes?: Lembrete[] | undefined;
  concluidaEm?: string | undefined;
  /** Na cópia concluída de uma recorrente: id da tarefa que continua repetindo. */
  origemId?: string | undefined;
  criadoEm: string;
  atualizadoEm: string;
  excluidoEm?: string | undefined;
}

export interface Lista {
  id: string;
  nome: string;
  cor?: string | undefined;
  ordem: string;
  criadoEm: string;
  atualizadoEm: string;
  excluidoEm?: string | undefined;
}

/** Id fixo da Inbox: igual em todos os aparelhos, para o sync não criar duas. */
export const INBOX_ID = "inbox";

export const LISTAS_INTELIGENTES = ["hoje", "amanha", "proximos7", "tudo", "concluidas", "lixeira"] as const;
export type ListaInteligente = (typeof LISTAS_INTELIGENTES)[number];

export const NOMES_INTELIGENTES: Record<ListaInteligente, string> = {
  hoje: "Hoje",
  amanha: "Amanhã",
  proximos7: "Próximos 7 dias",
  tudo: "Tudo",
  concluidas: "Concluídas",
  lixeira: "Lixeira",
};

/** Campos de uma tarefa nova vindos do quick-add (sem id, datas de sync nem lista resolvida). */
/** Campos de uma tarefa nova vindos do quick-add. Com hora, já vem com lembrete "na hora" (como no TickTick). */
export function dadosDoQuickAdd(
  p: ParsedTask,
): Pick<Tarefa, "titulo" | "data" | "hora" | "rrule" | "prioridade" | "tags" | "lembretes"> {
  return {
    titulo: p.title,
    data: p.date,
    hora: p.time,
    rrule: p.rrule,
    prioridade: p.priority,
    tags: p.tags,
    lembretes: p.time ? [{ antes: 0 }] : [],
  };
}

export const atrasada = (t: Tarefa, hoje: PlainDate): boolean =>
  t.status === "aberta" && t.data !== null && t.data < hoje;

/**
 * Tarefas visíveis numa lista inteligente. Hoje e Próximos 7 dias incluem as atrasadas.
 * Subtarefas aparecem nas listas por data (se tiverem data); em Tudo ficam dentro da mãe.
 * Na Lixeira não aparecem as que foram junto com a mãe (aparece só a mãe).
 */
export function filtrarInteligente(tarefas: Tarefa[], lista: ListaInteligente, hoje: PlainDate): Tarefa[] {
  const vivas = tarefas.filter((t) => !t.excluidoEm);
  const abertas = vivas.filter((t) => t.status === "aberta");
  switch (lista) {
    case "hoje":
      return ordenar(abertas.filter((t) => t.data !== null && t.data <= hoje));
    case "amanha": {
      const amanha = addDays(hoje, 1);
      return ordenar(abertas.filter((t) => t.data === amanha));
    }
    case "proximos7": {
      const fim = addDays(hoje, 6);
      return ordenar(abertas.filter((t) => t.data !== null && t.data <= fim));
    }
    case "tudo":
      return ordenar(abertas.filter((t) => !t.paiId));
    case "concluidas":
      return vivas
        .filter((t) => t.status !== "aberta")
        .sort((a, b) => (b.concluidaEm ?? b.atualizadoEm).localeCompare(a.concluidaEm ?? a.atualizadoEm));
    case "lixeira": {
      const porId = new Map(tarefas.map((t) => [t.id, t]));
      return tarefas
        .filter((t) => t.excluidoEm && !(t.paiId && porId.get(t.paiId)?.excluidoEm))
        .sort((a, b) => b.excluidoEm!.localeCompare(a.excluidoEm!));
    }
  }
}

/** Abertas de uma lista comum (Inbox ou criada pelo usuário). Subtarefas ficam dentro da mãe. */
export function filtrarLista(tarefas: Tarefa[], listaId: string): Tarefa[] {
  return ordenar(
    tarefas.filter((t) => !t.excluidoEm && t.status === "aberta" && t.listaId === listaId && !t.paiId),
  );
}

/** Mais cedo primeiro (atrasadas no topo), sem data no fim; empate: maior prioridade, depois mais antiga. */
export function ordenar(tarefas: Tarefa[]): Tarefa[] {
  const chave = (t: Tarefa) => (t.data ?? "9999-99-99") + " " + (t.hora ?? "99:99");
  return [...tarefas].sort(
    (a, b) => chave(a).localeCompare(chave(b)) || b.prioridade - a.prioridade || a.id.localeCompare(b.id),
  );
}

export interface ResultadoConclusao {
  /** A tarefa original, já alterada (concluída, ou avançada para a próxima data se repete). */
  tarefa: Tarefa;
  /** Numa recorrente: cópia concluída da ocorrência, para o histórico. Precisa de id novo. */
  copiaConcluida: Omit<Tarefa, "id"> | null;
}

/**
 * Concluir (ou marcar "não vou fazer"). Numa recorrente com regra suportada, a tarefa avança para a
 * próxima ocorrência (contada a partir da data dela) e uma cópia guarda o histórico, como no plano.
 */
export function concluir(
  t: Tarefa,
  agoraISO: string,
  hoje: PlainDate,
  como: Exclude<StatusTarefa, "aberta"> = "concluida",
): ResultadoConclusao {
  const proxima = t.rrule ? proximaOcorrencia(t.rrule, t.data ?? hoje) : null;
  if (!proxima) {
    return { tarefa: { ...t, status: como, concluidaEm: agoraISO, atualizadoEm: agoraISO }, copiaConcluida: null };
  }
  const { id: _id, ...resto } = t;
  return {
    tarefa: { ...t, data: proxima, atualizadoEm: agoraISO },
    copiaConcluida: {
      ...resto,
      data: t.data ?? hoje,
      rrule: null,
      status: como,
      concluidaEm: agoraISO,
      origemId: t.id,
      criadoEm: agoraISO,
      atualizadoEm: agoraISO,
    },
  };
}
