/** Dados de exemplo mostrados na primeira abertura, relativos ao mês atual e aos 3 anteriores. */
import { hojeLocal } from "@ticktick/core";
import type { NovaMeta, NovaMov } from "./financas";

export function gerarExemplos(hoje: Date): { movs: NovaMov[]; metas: NovaMeta[] } {
  const d = (dia: number, mesesAtras = 0) =>
    hojeLocal(new Date(hoje.getFullYear(), hoje.getMonth() - mesesAtras, dia));
  const mov = (p: Omit<NovaMov, "status"> & { status?: NovaMov["status"] }): NovaMov => ({
    status: "pago",
    ...p,
  });
  const movs: NovaMov[] = [
    ...[0, 1, 2, 3].flatMap((mo) => [
      mov({
        data: d(5, mo),
        tipo: "Entrada",
        descricao: "Salário",
        categoria: "Salário",
        contaId: "Conta Corrente",
        valor: 5200,
      }),
      mov({
        data: d(8, mo),
        tipo: "Despesa",
        descricao: "Aluguel",
        categoria: "Moradia",
        contaId: "Conta Corrente",
        valor: 1500,
      }),
      mov({
        data: d(12, mo),
        tipo: "Despesa",
        descricao: "Mercado",
        categoria: "Alimentação",
        contaId: "Cartão de Crédito",
        valor: 700 + mo * 60,
      }),
      mov({
        data: d(15, mo),
        tipo: "Investimento",
        descricao: "Aporte mensal",
        categoria: "Investimentos",
        contaId: "Investimentos",
        valor: 600,
      }),
    ]),
    mov({
      data: d(18),
      tipo: "Despesa",
      descricao: "Combustível",
      categoria: "Transporte",
      contaId: "Cartão de Crédito",
      valor: 320,
    }),
    mov({
      data: d(20),
      tipo: "Despesa",
      descricao: "Streaming",
      categoria: "Assinaturas",
      contaId: "Cartão de Crédito",
      valor: 55,
      status: "pendente",
    }),
    mov({
      data: d(22),
      tipo: "Despesa",
      descricao: "Cinema",
      categoria: "Lazer",
      contaId: "Dinheiro",
      valor: 90,
    }),
    mov({
      data: d(10),
      tipo: "Entrada",
      descricao: "Freela",
      categoria: "Freelances",
      contaId: "Conta Corrente",
      valor: 900,
    }),
  ];
  const metas: NovaMeta[] = [
    {
      nome: "Reserva de emergência",
      alvo: 15000,
      atual: 6200,
      prazo: `${hoje.getFullYear() + 1}-06-30`,
    },
    { nome: "Viagem de férias", alvo: 5000, atual: 5000 },
  ];
  return { movs, metas };
}
