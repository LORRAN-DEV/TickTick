import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseQuickAdd } from "../parser/quick-add.ts";
import { descreverRegra, lerRegra, proximaOcorrencia } from "./proxima.ts";

// 24/11/2026 é uma terça-feira.
describe("próxima ocorrência", () => {
  const casos: Array<[string, string, string | null]> = [
    ["FREQ=DAILY", "2026-11-24", "2026-11-25"],
    ["FREQ=DAILY;INTERVAL=3", "2026-11-30", "2026-12-03"],
    ["FREQ=WEEKLY", "2026-11-24", "2026-12-01"],
    ["FREQ=WEEKLY;INTERVAL=2", "2026-11-24", "2026-12-08"],
    ["FREQ=WEEKLY;BYDAY=MO", "2026-11-23", "2026-11-30"],
    ["FREQ=WEEKLY;BYDAY=MO,WE,FR", "2026-11-23", "2026-11-25"],
    ["FREQ=WEEKLY;BYDAY=MO,WE,FR", "2026-11-27", "2026-11-30"],
    ["FREQ=WEEKLY;BYDAY=SU", "2026-11-29", "2026-12-06"], // domingo é o fim da semana (WKST=MO)
    ["FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "2026-11-27", "2026-11-30"], // sexta → segunda
    ["FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH", "2026-11-23", "2026-11-26"],
    ["FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH", "2026-11-26", "2026-12-07"],
    ["FREQ=MONTHLY;BYMONTHDAY=5", "2026-12-05", "2027-01-05"],
    ["FREQ=MONTHLY;BYMONTHDAY=5", "2026-11-24", "2026-12-05"],
    ["FREQ=MONTHLY;BYMONTHDAY=31", "2027-01-31", "2027-03-31"], // fevereiro não tem 31: pula
    ["FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=10", "2026-11-10", "2027-01-10"],
    ["FREQ=MONTHLY", "2026-11-24", "2026-12-24"],
    ["FREQ=YEARLY", "2028-02-29", "2029-02-28"],
    ["FREQ=MONTHLY;BYDAY=1MO", "2026-11-24", null], // não suportado: não inventa data
    ["FREQ=HOURLY", "2026-11-24", null],
    ["lixo", "2026-11-24", null],
  ];
  for (const [rrule, base, esperado] of casos) {
    test(`${rrule} depois de ${base} → ${esperado}`, () => {
      assert.equal(proximaOcorrencia(rrule, base), esperado);
    });
  }
});

test("toda regra que o quick-add gera é suportada", () => {
  const now = new Date("2026-11-24T13:00:00Z");
  const frases = [
    "beber água todo dia",
    "academia toda segunda, quarta e sexta 7h",
    "relatório dias úteis",
    "pagar aluguel todo dia 5",
    "revisar a cada 2 semanas",
    "backup todo mês",
    "aniversário todo ano",
  ];
  for (const f of frases) {
    const p = parseQuickAdd(f, { now, timeZone: "America/Sao_Paulo" });
    assert.ok(p.rrule, `"${f}" deveria repetir`);
    assert.ok(lerRegra(p.rrule), `regra de "${f}" não suportada: ${p.rrule}`);
    assert.ok(proximaOcorrencia(p.rrule, p.date!)! > p.date!, f);
  }
});

test("descrição em português", () => {
  assert.equal(descreverRegra("FREQ=DAILY"), "todo dia");
  assert.equal(descreverRegra("FREQ=WEEKLY;BYDAY=MO,WE"), "toda seg, qua");
  assert.equal(descreverRegra("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"), "dias úteis");
  assert.equal(descreverRegra("FREQ=MONTHLY;BYMONTHDAY=5"), "todo mês no dia 5");
  assert.equal(descreverRegra("FREQ=WEEKLY;INTERVAL=2"), "a cada 2 semanas");
});
