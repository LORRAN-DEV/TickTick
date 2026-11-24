import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseQuickAdd, type ParsedTask } from "./quick-add.ts";

// Terça-feira, 24/11/2026, 10:00 em São Paulo.
const NOW = new Date("2026-11-24T13:00:00Z");
const TZ = "America/Sao_Paulo";
const parse = (text: string, now = NOW): ParsedTask => parseQuickAdd(text, { now, timeZone: TZ });

type Expected = Partial<Omit<ParsedTask, "matches">>;

function check(cases: Array<[string, Expected]>): void {
  for (const [input, expected] of cases) {
    test(input, () => {
      const got = parse(input);
      for (const [key, value] of Object.entries(expected)) {
        assert.deepEqual(got[key as keyof Expected], value, `campo "${key}"`);
      }
    });
  }
}

describe("datas relativas", () => {
  check([
    ["pagar boleto amanhã", { title: "pagar boleto", date: "2026-11-25", time: null }],
    ["reunião depois de amanhã às 9h30", { title: "reunião", date: "2026-11-26", time: "09:30" }],
    ["ligar para o banco hoje", { title: "ligar para o banco", date: "2026-11-24" }],
    ["AMANHÃ entregar relatório", { title: "entregar relatório", date: "2026-11-25" }],
    ["amanha sem acento", { title: "sem acento", date: "2026-11-25" }],
    ["revisar matéria daqui a 3 dias", { title: "revisar matéria", date: "2026-11-27" }],
    ["renovar CNH em duas semanas", { title: "renovar CNH", date: "2026-12-08" }],
    ["fechar caixa no fim do mês", { title: "fechar caixa", date: "2026-11-30" }],
    ["faxina no fim de semana", { title: "faxina", date: "2026-11-28" }],
  ]);
});

describe("dias da semana", () => {
  check([
    ["estudar cálculo sexta", { title: "estudar cálculo", date: "2026-11-27" }],
    ["ligar pro dentista na segunda de manhã", { title: "ligar pro dentista", date: "2026-11-30", time: "09:00" }],
    ["academia terça", { title: "academia", date: "2026-11-24" }],
    ["academia próxima terça", { title: "academia", date: "2026-12-01" }],
    ["entregar trabalho sexta que vem", { title: "entregar trabalho", date: "2026-11-27" }],
    ["call quarta-feira 14h", { title: "call", date: "2026-11-25", time: "14:00" }],
    ["feira sábado #casa", { title: "feira", date: "2026-11-28", tags: ["casa"] }],
  ]);
});

describe("datas absolutas", () => {
  check([
    ["entregar trabalho dia 10", { title: "entregar trabalho", date: "2026-12-10" }],
    ["pagar fatura dia 30", { title: "pagar fatura", date: "2026-11-30" }],
    ["aniversário da Ana 15/03", { title: "aniversário da Ana", date: "2027-03-15" }],
    ["prova 10 de dezembro", { title: "prova", date: "2026-12-10" }],
    ["viagem 5 jan", { title: "viagem", date: "2027-01-05" }],
    ["matrícula 03/02/2027", { title: "matrícula", date: "2027-02-03" }],
    ["data inválida 31/02", { title: "data inválida 31/02", date: null }],
  ]);
});

describe("horas", () => {
  check([
    ["lembrar remédio 22h", { title: "lembrar remédio", date: "2026-11-24", time: "22:00" }],
    ["café 8h", { title: "café", date: "2026-11-25", time: "08:00" }],
    ["reunião às 3 da tarde", { title: "reunião", date: "2026-11-24", time: "15:00" }],
    ["almoço meio-dia", { title: "almoço", date: "2026-11-24", time: "12:00" }],
    ["jantar hoje à noite", { title: "jantar", date: "2026-11-24", time: "20:00" }],
    ["call 14:30", { title: "call", time: "14:30" }],
    ["prova amanhã às 9", { title: "prova", date: "2026-11-25", time: "09:00" }],
    ["show sexta 9h da noite", { title: "show", date: "2026-11-27", time: "21:00" }],
  ]);
});

describe("recorrência", () => {
  check([
    ["beber água todo dia", { title: "beber água", rrule: "FREQ=DAILY", date: "2026-11-24" }],
    [
      "academia toda segunda, quarta e sexta 7h",
      { title: "academia", rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR", date: "2026-11-25", time: "07:00" },
    ],
    [
      "inglês todas as terças e quintas às 19h",
      { title: "inglês", rrule: "FREQ=WEEKLY;BYDAY=TU,TH", date: "2026-11-24", time: "19:00" },
    ],
    ["pagar aluguel todo dia 5", { title: "pagar aluguel", rrule: "FREQ=MONTHLY;BYMONTHDAY=5", date: "2026-12-05" }],
    ["backup a cada 2 semanas", { title: "backup", rrule: "FREQ=WEEKLY;INTERVAL=2", date: "2026-11-24" }],
    [
      "bater ponto dias úteis 8h",
      { title: "bater ponto", rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", date: "2026-11-25", time: "08:00" },
    ],
    ["revisar metas mensalmente", { title: "revisar metas", rrule: "FREQ=MONTHLY" }],
    ["tomar remédio todo dia 8h", { title: "tomar remédio", rrule: "FREQ=DAILY", date: "2026-11-25", time: "08:00" }],
  ]);
});

describe("marcadores", () => {
  check([
    [
      "comprar pão #mercado #Casa !alta ~pessoal",
      { title: "comprar pão", tags: ["mercado", "casa"], priority: 3, list: "pessoal" },
    ],
    ["revisar #cálculo !2", { title: "revisar", tags: ["cálculo"], priority: 2 }],
    ["sem prioridade", { priority: 0, tags: [], list: null }],
  ]);
});

describe("não confunde texto comum com data ou hora", () => {
  check([
    ["segunda prova de cálculo", { title: "segunda prova de cálculo", date: null }],
    ["quinta série", { title: "quinta série", date: null }],
    ["ler 15 páginas", { title: "ler 15 páginas", date: null, time: null }],
    ["estudar 2h", { title: "estudar 2h", time: null }],
    ["chegar tarde", { title: "chegar tarde", time: null }],
    ["levar as 3 meninas na escola", { title: "levar as 3 meninas na escola", time: null }],
    ["comprar 2 set de pratos", { title: "comprar 2 set de pratos", date: null }],
    ["presente Dia das Mães", { title: "presente Dia das Mães", date: null }],
  ]);
});

describe("detalhes", () => {
  test("marca os trechos reconhecidos com a posição no texto original", () => {
    const input = "comprar pão amanhã 15h #mercado";
    const { matches } = parse(input);
    assert.deepEqual(
      matches.map((m) => [m.kind, m.text]),
      [
        ["date", "amanhã"],
        ["time", "15h"],
        ["tag", "#mercado"],
      ],
    );
    for (const m of matches) assert.equal(input.slice(m.start, m.end), m.text);
  });

  test("usa a data local, não a UTC (23h30 em São Paulo já é dia seguinte em UTC)", () => {
    const lateNight = new Date("2026-11-25T02:30:00Z"); // 24/11 às 23:30 em SP
    assert.equal(parse("pagar conta amanhã", lateNight).date, "2026-11-25");
  });

  test("horários padrão dos períodos podem ser trocados", () => {
    const got = parseQuickAdd("correr de manhã", { now: NOW, timeZone: TZ, periods: { manha: "06:30" } });
    assert.equal(got.time, "06:30");
  });
});
