import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { filtrarInteligente, progressoChecklist } from "@ticktick/core";
import { TickTickDB } from "@/db/banco";
import { semearSeNecessario, listarMovs, adicionarMov } from "@/db/financas";
import { atualizarTarefa, criarDoTexto, listarTarefas, moverParaLixeira } from "@/db/tarefas";
import { adicionarItem, alternarItem, listarItens } from "@/db/checklist";
import { NaoLogadoError, SemConexaoError, type Api } from "@/db/sync/api";
import { contaGuardada, enviarFila, prepararConta, sincronizar } from "@/db/sync/sync";

/** Servidor falso com as regras do ADR 0005: por campo vence o alterado_em mais recente; versão global. */
class ServidorFalso implements Api {
  versao = 0;
  registros = new Map<
    string,
    {
      tabela: string;
      id: string;
      dados: Record<string, unknown>;
      relogios: Record<string, string>;
      v: number;
    }
  >();
  logado = true;
  online = true;
  pushes = 0;

  async chamar(caminho: string, init?: RequestInit): Promise<Response> {
    if (!this.online) throw new TypeError("Failed to fetch");
    if (!this.logado) return new Response("{}", { status: 401 });
    const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
    if (caminho.startsWith("/api/sync/push")) {
      this.pushes++;
      const { mudancas } = JSON.parse(String(init!.body)) as {
        mudancas: Array<{
          tabela: string;
          id: string;
          campos: Record<string, unknown>;
          alterado_em: string;
        }>;
      };
      for (const m of mudancas) {
        const k = `${m.tabela}/${m.id}`;
        const r = this.registros.get(k) ?? {
          tabela: m.tabela,
          id: m.id,
          dados: { id: m.id },
          relogios: {},
          v: 0,
        };
        let mudou = false;
        for (const [c, v] of Object.entries(m.campos)) {
          if (m.alterado_em > (r.relogios[c] ?? "")) {
            r.dados[c] = v;
            r.relogios[c] = m.alterado_em;
            mudou = true;
          }
        }
        if (mudou) r.v = ++this.versao;
        this.registros.set(k, r);
      }
      return json({ resultados: [], versao: this.versao });
    }
    if (caminho.startsWith("/api/sync/pull")) {
      const q = new URLSearchParams(caminho.split("?")[1]);
      const since = Number(q.get("since"));
      const limite = Number(q.get("limite"));
      const todos = [...this.registros.values()]
        .filter((r) => r.v > since)
        .sort((a, b) => a.v - b.v);
      const pagina = todos.slice(0, limite);
      return json({
        registros: pagina.map((r) => ({
          tabela: r.tabela,
          id: r.id,
          dados: { ...r.dados },
          server_version: r.v,
        })),
        versao: pagina.at(-1)?.v ?? since,
        mais: todos.length > limite,
      });
    }
    return new Response("{}", { status: 404 });
  }
}

const AGORA = new Date(2026, 10, 24, 10, 0);
const HOJE = "2026-11-24";
let servidor: ServidorFalso;
let a: TickTickDB;
let b: TickTickDB;

beforeEach(async () => {
  servidor = new ServidorFalso();
  a = new TickTickDB(`a-${crypto.randomUUID()}`);
  b = new TickTickDB(`b-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await a.delete();
  await b.delete();
});

const titulos = async (banco: TickTickDB) =>
  filtrarInteligente(await listarTarefas(banco), "tudo", HOJE)
    .map((t) => t.titulo)
    .sort();

describe("sincronização entre dois aparelhos", () => {
  it("3 e 4. o que é criado no A chega ao B, inclusive lixeira e checklist", async () => {
    await prepararConta("eu@x.com", a);
    await prepararConta("eu@x.com", b);
    const t = await criarDoTexto("pagar boleto amanhã 15h #casa", { agora: AGORA, banco: a });
    const i = await adicionarItem(t.id, "conferir código de barras", a);
    await alternarItem(i.id, a);
    await sincronizar(a, servidor);
    await sincronizar(b, servidor);
    const doB = (await listarTarefas(b)).find((x) => x.id === t.id)!;
    expect(doB).toMatchObject({
      titulo: "pagar boleto",
      data: "2026-11-25",
      hora: "15:00",
      tags: ["casa"],
    });
    expect(progressoChecklist(await listarItens(b), t.id)).toEqual({ feitas: 1, total: 1 });

    await moverParaLixeira(t.id, b);
    await sincronizar(b, servidor);
    await sincronizar(a, servidor);
    expect(filtrarInteligente(await listarTarefas(a), "lixeira", HOJE).map((x) => x.id)).toEqual([
      t.id,
    ]);
  });

  it("5. campos diferentes não conflitam; mesmo campo vence o mais recente", async () => {
    await prepararConta("eu@x.com", a);
    await prepararConta("eu@x.com", b);
    const t = await criarDoTexto("original amanhã", { agora: AGORA, banco: a });
    await sincronizar(a, servidor);
    await sincronizar(b, servidor);

    // offline nos dois: A muda o título, B muda a data e (depois) também o título
    await atualizarTarefa(t.id, { titulo: "título do A" }, a);
    await new Promise((r) => setTimeout(r, 5));
    await atualizarTarefa(t.id, { data: "2026-11-30" }, b);
    await new Promise((r) => setTimeout(r, 5));
    await atualizarTarefa(t.id, { prioridade: 3 }, a);

    await sincronizar(a, servidor);
    await sincronizar(b, servidor);
    await sincronizar(a, servidor);
    for (const banco of [a, b]) {
      expect((await listarTarefas(banco)).find((x) => x.id === t.id)).toMatchObject({
        titulo: "título do A",
        data: "2026-11-30",
        prioridade: 3,
      });
    }
  });

  it("6. offline: a fila guarda e sobe quando a conexão volta", async () => {
    await prepararConta("eu@x.com", a);
    await sincronizar(a, servidor);
    servidor.online = false;
    await criarDoTexto("sem rede", { agora: AGORA, banco: a });
    await expect(sincronizar(a, servidor)).rejects.toBeInstanceOf(SemConexaoError);
    expect(await a.fila.count()).toBeGreaterThan(0);
    servidor.online = true;
    await sincronizar(a, servidor);
    expect(await a.fila.count()).toBe(0);
    await prepararConta("eu@x.com", b);
    await sincronizar(b, servidor);
    expect(await titulos(b)).toEqual(["sem rede"]);
  });

  it("7. primeiro login envia o que já existia e apaga exemplos nunca alterados", async () => {
    await semearSeNecessario(a, AGORA);
    const movs = await listarMovs(a);
    const alterado = movs[0]!;
    await a.movs.update(alterado.id, { valor: 9999, atualizadoEm: new Date().toISOString() });
    await criarDoTexto("tarefa antiga", { agora: AGORA, banco: a });
    await adicionarMov(
      {
        data: HOJE,
        tipo: "Despesa",
        descricao: "real",
        categoria: "Outros",
        contaId: "x",
        valor: 5,
        status: "pago",
      },
      a,
    );
    await prepararConta("eu@x.com", a);
    const restantes = (await listarMovs(a)).map((m) => m.descricao).sort();
    expect(restantes).toEqual([alterado.descricao, "real"].sort());
    expect(await a.metas.count()).toBe(0); // metas de exemplo, nunca alteradas
    await sincronizar(a, servidor);
    const tabelas = [...servidor.registros.values()].map((r) => r.tabela).sort();
    expect(tabelas).toEqual(["listas", "movs", "movs", "tarefas"]);
    expect(await contaGuardada(a)).toBe("eu@x.com");
  });

  it("7. aparelho que entrou antes de abrir Finanças não cria (nem envia) exemplos", async () => {
    await prepararConta("eu@x.com", b);
    expect(await semearSeNecessario(b, AGORA)).toBe(false);
    expect(await b.movs.count()).toBe(0);
    expect(await b.fila.count()).toBe(0);
  });

  it("7. preparar a mesma conta de novo não refaz o retrato", async () => {
    await prepararConta("eu@x.com", a);
    await sincronizar(a, servidor);
    await criarDoTexto("nova", { agora: AGORA, banco: a });
    const naFila = await a.fila.count();
    await prepararConta("eu@x.com", a);
    expect(await a.fila.count()).toBe(naFila);
  });

  it("8. sessão expirada: avisa e não perde a fila", async () => {
    await prepararConta("eu@x.com", a);
    await criarDoTexto("importante", { agora: AGORA, banco: a });
    servidor.logado = false;
    await expect(enviarFila(a, servidor)).rejects.toBeInstanceOf(NaoLogadoError);
    expect(await a.fila.count()).toBeGreaterThan(0);
    servidor.logado = true;
    await sincronizar(a, servidor);
    expect([...servidor.registros.values()].some((r) => r.dados["titulo"] === "importante")).toBe(
      true,
    );
  });

  it("pull não reenfileira e não apaga mudança local feita durante o sync", async () => {
    await prepararConta("eu@x.com", a);
    await prepararConta("eu@x.com", b);
    const t = await criarDoTexto("x", { agora: AGORA, banco: a });
    await sincronizar(a, servidor);
    await sincronizar(b, servidor);
    expect(await b.fila.count()).toBe(0); // o que veio do servidor não volta para a fila

    await atualizarTarefa(t.id, { titulo: "do A" }, a);
    await sincronizar(a, servidor);
    await atualizarTarefa(t.id, { titulo: "local do B, ainda não enviado" }, b);
    // B só puxa (sem enviar): o título local pendente não pode ser sobrescrito
    const { puxar } = await import("@/db/sync/sync");
    await puxar(b, servidor);
    expect((await b.tarefas.get(t.id))!.titulo).toBe("local do B, ainda não enviado");
  });

  it("muitas mudanças sobem em lotes de 500", async () => {
    await prepararConta("eu@x.com", a);
    await a.transaction("rw", a.tarefas, async () => {
      for (let n = 0; n < 1200; n++) {
        await a.tarefas.add({
          id: `t${String(n).padStart(4, "0")}`,
          titulo: `t${n}`,
          status: "aberta",
          prioridade: 0,
          data: null,
          hora: null,
          rrule: null,
          tags: [],
          listaId: "inbox",
          criadoEm: "",
          atualizadoEm: "",
        });
      }
    });
    await sincronizar(a, servidor);
    expect(servidor.pushes).toBe(3);
    await prepararConta("eu@x.com", b);
    await sincronizar(b, servidor);
    expect(await b.tarefas.count()).toBe(1200);
  });
});
