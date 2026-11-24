/** Textos curtos para mostrar datas e prioridades de tarefas na tela. */
import {
  addDays,
  dataBR,
  weekdayOf,
  type MatchKind,
  type PlainDate,
  type Priority,
} from "@ticktick/core";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "Hoje", "Amanhã", "Ontem", "quinta" (próximos 6 dias) ou "05/12/2026". */
export function rotuloData(data: PlainDate, hoje: PlainDate): string {
  if (data === hoje) return "Hoje";
  if (data === addDays(hoje, 1)) return "Amanhã";
  if (data === addDays(hoje, -1)) return "Ontem";
  if (data > hoje && data <= addDays(hoje, 6)) return DIAS[weekdayOf(data)]!;
  return dataBR(data);
}

export const NOMES_PRIORIDADE: Record<Priority, string> = {
  0: "Nenhuma",
  1: "Baixa",
  2: "Média",
  3: "Alta",
};

/** Cor (token do tema) de cada prioridade; nenhuma = sem cor. */
export const COR_PRIORIDADE: Record<Priority, string | null> = {
  0: null,
  1: "var(--chart-5)",
  2: "var(--invest)",
  3: "var(--expense)",
};

export const NOMES_TRECHO: Record<MatchKind, string> = {
  date: "Data",
  time: "Hora",
  recurrence: "Repete",
  priority: "Prioridade",
  tag: "Tag",
  list: "Lista",
};
