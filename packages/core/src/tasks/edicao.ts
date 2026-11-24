/**
 * Edição de uma tarefa já criada: aplica mudanças mantendo a tarefa coerente
 * (hora e repetição precisam de data, regras semanais/mensais acompanham a data).
 */
import { weekdayOf, dayOf, type PlainDate } from "../parser/dates.ts";
import { lerRegra } from "../recurrence/proxima.ts";
import { normalizarLembretes } from "./lembretes.ts";
import type { Tarefa } from "./tarefas.ts";

export class TituloVazioError extends Error {
  constructor() {
    super("A tarefa precisa de um título");
    this.name = "TituloVazioError";
  }
}

export class HoraInvalidaError extends Error {
  constructor(hora: string) {
    super(`Hora inválida: ${hora}`);
    this.name = "HoraInvalidaError";
  }
}

/** Mesma regra das tags do quick-add: minúsculas, sem `#`, sem repetir. Aceita vírgula ou espaço entre elas. */
export function normalizarTags(texto: string): string[] {
  const tags: string[] = [];
  for (const bruta of texto.split(/[\s,;]+/)) {
    const tag = bruta.replace(/^#+/, "").replace(/[^\p{L}\p{N}_/-]/gu, "").toLowerCase();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

export const REPETICOES_PRONTAS = ["nenhuma", "diaria", "semanal", "dias_uteis", "mensal", "anual"] as const;
export type RepeticaoPronta = (typeof REPETICOES_PRONTAS)[number];

export const NOMES_REPETICAO: Record<RepeticaoPronta, string> = {
  nenhuma: "Não repete",
  diaria: "Todo dia",
  semanal: "Toda semana",
  dias_uteis: "Dias úteis",
  mensal: "Todo mês",
  anual: "Todo ano",
};

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/** RRULE de uma opção pronta, ancorada na data da tarefa. */
export function regraDaRepeticao(r: RepeticaoPronta, data: PlainDate): string | null {
  switch (r) {
    case "nenhuma":
      return null;
    case "diaria":
      return "FREQ=DAILY";
    case "semanal":
      return `FREQ=WEEKLY;BYDAY=${BYDAY[weekdayOf(data)]}`;
    case "dias_uteis":
      return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    case "mensal":
      return `FREQ=MONTHLY;BYMONTHDAY=${dayOf(data)}`;
    case "anual":
      return "FREQ=YEARLY";
  }
}

/** Qual opção pronta uma regra representa, ou "personalizada" (ex.: "toda seg, qua, sex"). */
export function repeticaoDaRegra(rrule: string | null, data: PlainDate | null): RepeticaoPronta | "personalizada" {
  if (!rrule) return "nenhuma";
  const r = lerRegra(rrule);
  if (!r || r.intervalo !== 1) return "personalizada";
  const dias = [...r.diasDaSemana].sort();
  if (r.freq === "DAILY") return "diaria";
  if (r.freq === "YEARLY") return "anual";
  if (r.freq === "WEEKLY") {
    if (dias.length === 0) return "semanal";
    if (dias.join() === "1,2,3,4,5") return "dias_uteis";
    if (dias.length === 1 && data && dias[0] === weekdayOf(data)) return "semanal";
    return "personalizada";
  }
  // MONTHLY
  if (r.diaDoMes === null || (data && r.diaDoMes === dayOf(data))) return "mensal";
  return "personalizada";
}

export type MudancasTarefa = Partial<
  Pick<Tarefa, "titulo" | "notas" | "prioridade" | "data" | "hora" | "tags" | "listaId" | "rrule" | "lembretes">
>;

/**
 * Aplica mudanças a uma tarefa. Regras:
 * - título não pode ficar vazio (lança TituloVazioError);
 * - sem data não há hora nem repetição; escolher repetição sem data usa hoje;
 * - mudar a data de uma tarefa "toda semana"/"todo mês" leva a regra junto para o novo dia.
 */
export function editarTarefa(t: Tarefa, m: MudancasTarefa, agoraISO: string, hoje: PlainDate): Tarefa {
  const novo: Tarefa = { ...t, ...m, atualizadoEm: agoraISO };

  if ("titulo" in m) {
    novo.titulo = (m.titulo ?? "").trim();
    if (!novo.titulo) throw new TituloVazioError();
  }
  if ("notas" in m) novo.notas = m.notas?.trim() ? m.notas : undefined;
  if ("lembretes" in m) novo.lembretes = normalizarLembretes(m.lembretes);
  if ("hora" in m && m.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.hora)) throw new HoraInvalidaError(m.hora);

  const tirouData = "data" in m && m.data === null;
  if (novo.rrule && !novo.data) {
    if (tirouData && !("rrule" in m)) novo.rrule = null;
    else novo.data = hoje;
  }
  if (!novo.data) novo.hora = null;

  // A regra acompanha a data quando era "toda semana"/"todo mês" no dia antigo.
  if ("data" in m && !("rrule" in m) && novo.rrule && novo.data && t.data !== novo.data) {
    const antes = repeticaoDaRegra(t.rrule, t.data);
    if (antes === "semanal" || antes === "mensal") novo.rrule = regraDaRepeticao(antes, novo.data);
  }
  return novo;
}
