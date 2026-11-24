import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  hojeLocal, mesAnterior, porCategoria, resumoMes, saldoConta, saldoTotal, statusMeta, variacao, vencimentos,
  type Conta, type Mov,
} from "./finance.ts";
import { parseCSV, parseData, parseValor, toCSV } from "./format.ts";

const m = (p: Partial<Mov>): Mov => ({
  id: "x", data: "2026-10-05", tipo: "Despesa", descricao: "", categoria: "Outros", contaId: "c1",
  valor: 0, status: "pago", criadoEm: "", atualizadoEm: "", ...p,
});
const c1: Conta = { id: "c1", nome: "Corrente", tipo: "Conta corrente", saldoInicial: 1000, ativa: true };
const c2: Conta = { id: "c2", nome: "Poupança", tipo: "Poupança", saldoInicial: 0, ativa: true };

describe("resumo do mês", () => {
  test("saldo = entradas - despesas - investimentos (só pagas, só do mês)", () => {
    const r = resumoMes(
      [m({ tipo: "Entrada", valor: 5000 }), m({ valor: 1200 }), m({ tipo: "Investimento", valor: 800 }), m({ valor: 999, data: "2026-09-30" })],
      "2026-10",
    );
    assert.equal(r.saldo, 3000);
  });

  test("canceladas não entram e pendentes ficam separadas", () => {
    const r = resumoMes([m({ valor: 100, status: "cancelado" }), m({ valor: 50, status: "pendente" }), m({ valor: 10 })], "2026-10");
    assert.equal(r.despesas, 10);
    assert.equal(r.pendDespesas, 50);
  });

  test("mês anterior atravessa a virada do ano", () => {
    assert.equal(mesAnterior("2026-01"), "2025-12");
    assert.equal(mesAnterior("2026-03"), "2026-02");
  });

  test("variação sem base de comparação", () => {
    assert.equal(variacao(150, 100), 0.5);
    assert.equal(variacao(0, 0), 0);
    assert.equal(variacao(10, 0), null);
  });
});

describe("contas", () => {
  test("transferência não é receita nem despesa e move saldo entre contas", () => {
    const movs = [m({ tipo: "Transferência", valor: 300, contaDestinoId: "c2" })];
    const r = resumoMes(movs, "2026-10");
    assert.equal(r.entradas, 0);
    assert.equal(r.despesas, 0);
    assert.equal(saldoConta(c1, movs), 700);
    assert.equal(saldoConta(c2, movs), 300);
    assert.equal(saldoTotal([c1, c2], movs), 1000);
  });

  test("saldo até uma data ignora movimentações posteriores", () => {
    const movs = [m({ tipo: "Entrada", valor: 200, data: "2026-10-01" }), m({ valor: 50, data: "2026-10-20" })];
    assert.equal(saldoConta(c1, movs, "2026-10-10"), 1200);
  });
});

test("% por categoria sobre despesas", () => {
  const c = porCategoria([m({ categoria: "Moradia", valor: 300 }), m({ categoria: "Lazer", valor: 100 })], "2026-10");
  assert.equal(c.find((x) => x.categoria === "Moradia")!.pct, 0.75);
  assert.deepEqual(c.map((x) => x.categoria), ["Moradia", "Lazer"]);
});

test("meta só concluída quando acumulado >= alvo", () => {
  assert.equal(statusMeta({ id: "1", nome: "a", alvo: 100, atual: 99.99 }).status, "Em andamento");
  assert.equal(statusMeta({ id: "1", nome: "a", alvo: 100, atual: 100 }).status, "Concluída");
  assert.deepEqual(statusMeta({ id: "1", nome: "a", alvo: 100, atual: 40, prazo: "2026-01-01" }, "2026-10-26"), {
    pct: 0.4, falta: 60, status: "Atrasada",
  });
});

describe("vencimentos", () => {
  test("pendentes vencidas e dos próximos 7 dias", () => {
    const v = vencimentos(
      [m({ status: "pendente", data: "2026-10-20" }), m({ status: "pendente", data: "2026-11-02" }), m({ status: "pendente", data: "2026-11-03" })],
      "2026-10-26",
    );
    assert.deepEqual(v.map((x) => x.data), ["2026-10-20", "2026-11-02"]);
    assert.equal(v[0]!.atrasada, true);
  });

  test("limite não depende do fuso do computador", () => {
    const v = vencimentos([m({ status: "pendente", data: "2026-12-01" })], "2026-11-24");
    assert.equal(v.length, 1);
  });
});

test("hoje é a data local, não UTC", () => {
  assert.equal(hojeLocal(new Date(2026, 10, 24, 23, 30)), "2026-11-24");
});

describe("formatos brasileiros", () => {
  test("valores e datas", () => {
    assert.equal(parseValor("R$ 1.234,56"), 1234.56);
    assert.equal(parseValor("1234.56"), 1234.56);
    assert.ok(Number.isNaN(parseValor("abc")));
    assert.equal(parseData("5/3/2026"), "2026-03-05");
    assert.equal(parseData("2026-03-05T10:00"), "2026-03-05");
    assert.equal(parseData("março"), "");
  });

  test("CSV ida e volta com ; e aspas", () => {
    const rows = [["Data", "Descrição", "Valor"], ["05/10/2026", 'Pão "francês"; 6 un', "12,50"]];
    assert.deepEqual(parseCSV(toCSV(rows)), rows);
  });

  test("CSV com vírgula e CRLF", () => {
    assert.deepEqual(parseCSV("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
  });
});
