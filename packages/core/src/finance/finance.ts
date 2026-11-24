/**
 * Controle financeiro: tipos e cálculos puros (sem React, sem I/O).
 *
 * Datas são PlainDate ("YYYY-MM-DD", calendário local) e meses são "YYYY-MM",
 * como no parser de quick-add.
 */
import { addDays, addMonths, type PlainDate } from "../parser/dates.ts";

export const TIPOS = ["Entrada", "Despesa", "Investimento", "Transferência"] as const;
export type Tipo = (typeof TIPOS)[number];
export type CatTipo = Exclude<Tipo, "Transferência">;
export const STATUS = ["pago", "pendente", "cancelado"] as const;
export type Status = (typeof STATUS)[number];
export const TIPOS_CONTA = ["Conta corrente", "Poupança", "Carteira", "Cartão de crédito", "Investimentos", "Outra"] as const;

export interface Mov {
  id: string;
  data: PlainDate;
  tipo: Tipo;
  descricao: string;
  categoria: string;
  contaId: string;
  contaDestinoId?: string | undefined;
  valor: number;
  status: Status;
  obs?: string | undefined;
  criadoEm: string;
  atualizadoEm: string;
  /** Exclusão lógica: preenchido quando a movimentação foi apagada. */
  excluidoEm?: string | undefined;
  /** Dado de exemplo criado na primeira abertura (não sobe no sync se nunca for alterado). */
  exemplo?: boolean | undefined;
}

export interface Conta {
  id: string;
  nome: string;
  tipo: string;
  saldoInicial: number;
  ativa: boolean;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: CatTipo;
  ativa: boolean;
}

export interface Meta {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo?: PlainDate | undefined;
  descricao?: string | undefined;
  criadoEm?: string | undefined;
  atualizadoEm?: string | undefined;
  /** Exclusão lógica: preenchido quando a meta foi apagada. */
  excluidoEm?: string | undefined;
  /** Dado de exemplo criado na primeira abertura (não sobe no sync se nunca for alterado). */
  exemplo?: boolean | undefined;
}

export const CATEGORIAS_INICIAIS: Array<[string, CatTipo]> = [
  ["Alimentação", "Despesa"], ["Moradia", "Despesa"], ["Transporte", "Despesa"], ["Saúde", "Despesa"],
  ["Educação", "Despesa"], ["Lazer", "Despesa"], ["Assinaturas", "Despesa"], ["Compras", "Despesa"],
  ["Outros", "Despesa"], ["Salário", "Entrada"], ["Freelances", "Entrada"], ["Rendimentos", "Entrada"],
  ["Outros", "Entrada"], ["Investimentos", "Investimento"],
];
export const CATEGORIAS = [...new Set(CATEGORIAS_INICIAIS.map(([n]) => n))];
export const CONTAS = ["Conta Corrente", "Poupança", "Cartão de Crédito", "Dinheiro", "Investimentos"];

/** Data de hoje no calendário local (não UTC: 23h em São Paulo ainda é hoje). */
export function hojeLocal(now: Date = new Date()): PlainDate {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const noMes = (d: PlainDate, ym: string) => d.slice(0, 7) === ym;
const efetivada = (m: Mov) => m.status === "pago";

/** Totais do mês. Só movimentações pagas contam; pendentes ficam à parte; canceladas somem. */
export function resumoMes(movs: Mov[], ym: string) {
  const soma = (t: Tipo, filtro: (m: Mov) => boolean = efetivada) =>
    movs.filter((m) => m.tipo === t && filtro(m) && noMes(m.data, ym)).reduce((a, m) => a + m.valor, 0);
  const entradas = soma("Entrada");
  const despesas = soma("Despesa");
  const investimentos = soma("Investimento");
  return {
    entradas,
    despesas,
    investimentos,
    saldo: entradas - despesas - investimentos,
    pendEntradas: soma("Entrada", (m) => m.status === "pendente"),
    pendDespesas: soma("Despesa", (m) => m.status === "pendente"),
  };
}

export function mesAnterior(ym: string): string {
  return addMonths(`${ym}-01`, -1).slice(0, 7);
}

/** Variação relativa; null quando não há base de comparação (anterior = 0 e atual ≠ 0). */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return atual ? null : 0;
  return (atual - anterior) / Math.abs(anterior);
}

export function porCategoria(movs: Mov[], ym: string | null, tipo: CatTipo = "Despesa") {
  const f = movs.filter((m) => m.tipo === tipo && efetivada(m) && (!ym || noMes(m.data, ym)));
  const total = f.reduce((a, m) => a + m.valor, 0);
  const mapa = new Map<string, number>();
  for (const m of f) mapa.set(m.categoria, (mapa.get(m.categoria) ?? 0) + m.valor);
  return [...mapa]
    .map(([categoria, valor]) => ({ categoria, valor, pct: total ? valor / total : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

export function resumoAno(movs: Mov[], ano: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const ym = `${ano}-${String(i + 1).padStart(2, "0")}`;
    const mes = new Date(ano, i, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    return { ym, mes, ...resumoMes(movs, ym) };
  });
}

/** Saldo de uma conta até uma data (inclusive). Só conta pagas. Transferências movem entre contas. */
export function saldoConta(c: Conta, movs: Mov[], ate: PlainDate = "9999-12-31"): number {
  return movs
    .filter((m) => efetivada(m) && m.data <= ate)
    .reduce((s, m) => {
      if (m.tipo === "Transferência") {
        if (m.contaId === c.id) s -= m.valor;
        if (m.contaDestinoId === c.id) s += m.valor;
        return s;
      }
      if (m.contaId !== c.id) return s;
      return m.tipo === "Entrada" ? s + m.valor : s - m.valor;
    }, c.saldoInicial);
}

export function saldoTotal(contas: Conta[], movs: Mov[], ate?: PlainDate): number {
  return contas.reduce((a, c) => a + saldoConta(c, movs, ate), 0);
}

/** Despesas pendentes vencidas ou que vencem nos próximos `dias` dias. */
export function vencimentos(movs: Mov[], hoje: PlainDate, dias = 7) {
  const limite = addDays(hoje, dias);
  return movs
    .filter((m) => m.tipo === "Despesa" && m.status === "pendente" && m.data <= limite)
    .map((m) => ({ ...m, atrasada: m.data < hoje }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

export type StatusMeta = "Concluída" | "Atrasada" | "Em andamento";

export function statusMeta(m: Meta, hoje: PlainDate = hojeLocal()): { pct: number; falta: number; status: StatusMeta } {
  const pct = m.alvo ? m.atual / m.alvo : 0;
  const falta = Math.max(m.alvo - m.atual, 0);
  const status: StatusMeta =
    m.atual >= m.alvo && m.alvo > 0 ? "Concluída" : m.prazo && m.prazo < hoje ? "Atrasada" : "Em andamento";
  return { pct, falta, status };
}
