/**
 * Sincronização com o servidor (ADR 0005 e 0006): envia a fila de saída e puxa o que mudou.
 * Não depende de React; quem decide quando chamar é `useSync`.
 */
import { db, type TickTickDB } from "../banco";
import { apiPadrao, chamarJson, type Api } from "./api";
import {
  MARCA_REMOTA,
  TABELAS_SINCRONIZADAS,
  type EntradaFila,
  type TabelaSincronizada,
} from "./fila";

const LOTE = 500;
const CHAVE_VERSAO = "sync.versao";
const CHAVE_CONTA = "sync.conta";

interface RegistroRemoto {
  tabela: TabelaSincronizada;
  id: string;
  dados: Record<string, unknown>;
  server_version: number;
}

type Generico = Record<string, unknown> & { id: string };
const tabelas = (banco: TickTickDB) =>
  TABELAS_SINCRONIZADAS.map((t) => banco.table<Generico, string>(t));

/** E-mail da conta deste aparelho (guardado para saber que há login mesmo offline). */
export async function contaGuardada(banco: TickTickDB = db): Promise<string | null> {
  return ((await banco.config.get(CHAVE_CONTA))?.valor as string | undefined) ?? null;
}

/**
 * Primeiro login nesta conta, neste aparelho: troca a fila por um retrato completo do que existe
 * (cada registro inteiro, com o horário da última alteração dele) e apaga os exemplos nunca alterados.
 */
export async function prepararConta(email: string, banco: TickTickDB = db): Promise<void> {
  await banco.transaction("rw", [...tabelas(banco), banco.fila, banco.config], async () => {
    if ((await contaGuardada(banco)) === email) return;
    await banco.fila.clear();
    for (const t of [banco.movs, banco.metas]) {
      const exemplos = await t
        .filter((r) => !!r.exemplo && r.criadoEm === r.atualizadoEm)
        .primaryKeys();
      await t.bulkDelete(exemplos as string[]);
    }
    const agora = new Date().toISOString();
    for (const t of tabelas(banco)) {
      const entradas: EntradaFila[] = (await t.toArray()).map((r) => {
        const { id, ...campos } = r;
        return {
          tabela: t.name as TabelaSincronizada,
          registroId: id,
          campos: JSON.parse(JSON.stringify(campos)) as Record<string, unknown>, // tira os undefined
          alteradoEm: typeof r["atualizadoEm"] === "string" ? r["atualizadoEm"] : agora,
        };
      });
      await banco.fila.bulkAdd(entradas);
    }
    await banco.config.bulkPut([
      { chave: CHAVE_CONTA, valor: email },
      { chave: CHAVE_VERSAO, valor: 0 },
    ]);
  });
}

/** Ao sair: esquece a conta e a versão (os dados e a fila ficam no aparelho). */
export async function esquecerConta(banco: TickTickDB = db): Promise<void> {
  await banco.config.bulkDelete([CHAVE_CONTA, CHAVE_VERSAO]);
}

/** Envia a fila em lotes; cada lote confirmado sai da fila. Devolve quantas mudanças subiram. */
export async function enviarFila(banco: TickTickDB = db, api: Api = apiPadrao): Promise<number> {
  let enviados = 0;
  for (;;) {
    const lote = await banco.fila.orderBy("seq").limit(LOTE).toArray();
    if (!lote.length) return enviados;
    await chamarJson(api, "/api/sync/push", {
      method: "POST",
      body: JSON.stringify({
        mudancas: lote.map((e) => ({
          tabela: e.tabela,
          id: e.registroId,
          campos: e.campos,
          alterado_em: e.alteradoEm,
        })),
      }),
    });
    await banco.fila.bulkDelete(lote.map((e) => e.seq!));
    enviados += lote.length;
  }
}

/** Aplica um registro do servidor sem passar pela fila, preservando campos com mudança local pendente. */
async function aplicar(banco: TickTickDB, r: RegistroRemoto): Promise<void> {
  const tabela = banco.table<Generico, string>(r.tabela);
  const pendentes = await banco.fila
    .where("[tabela+registroId]")
    .equals([r.tabela, r.id])
    .toArray();
  const locais = new Set(pendentes.flatMap((e) => Object.keys(e.campos)));
  const novo: Record<string, unknown> = { ...(await tabela.get(r.id)) };
  for (const [campo, valor] of Object.entries(r.dados)) {
    if (campo === "id" || locais.has(campo)) continue;
    // null fica null: em `hora`/`data`/`rrule` é um valor de verdade ("sem hora"); nos campos opcionais
    // (concluidaEm, excluidoEm...) o app já trata null como "sem valor".
    novo[campo] = valor;
  }
  await tabela.put({ ...novo, id: r.id, [MARCA_REMOTA]: true } as Generico);
}

/** Puxa o que mudou desde a última versão vista, página por página. Devolve quantos registros vieram. */
export async function puxar(banco: TickTickDB = db, api: Api = apiPadrao): Promise<number> {
  let recebidos = 0;
  for (;;) {
    const since = ((await banco.config.get(CHAVE_VERSAO))?.valor as number | undefined) ?? 0;
    const p = await chamarJson<{ registros: RegistroRemoto[]; versao: number; mais: boolean }>(
      api,
      `/api/sync/pull?since=${since}&limite=${LOTE}`,
    );
    const conhecidos = p.registros.filter((r) =>
      (TABELAS_SINCRONIZADAS as readonly string[]).includes(r.tabela),
    );
    await banco.transaction("rw", [...tabelas(banco), banco.fila, banco.config], async () => {
      for (const r of conhecidos) await aplicar(banco, r);
      await banco.config.put({ chave: CHAVE_VERSAO, valor: p.versao });
    });
    recebidos += conhecidos.length;
    if (!p.mais) return recebidos;
  }
}

/** Um ciclo completo: envia, depois puxa. */
export async function sincronizar(
  banco: TickTickDB = db,
  api: Api = apiPadrao,
): Promise<{ enviados: number; recebidos: number }> {
  const enviados = await enviarFila(banco, api);
  const recebidos = await puxar(banco, api);
  return { enviados, recebidos };
}
