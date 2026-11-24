/**
 * Fila de saída do sync (ADR 0006): um middleware do Dexie que, em toda gravação nas tabelas
 * sincronizadas, compara o registro antes e depois e grava os campos alterados na tabela `fila`,
 * na mesma transação do IndexedDB.
 */
import type { DBCore, DBCoreMutateRequest, DBCoreTable, Middleware } from "dexie";

/** Tabelas que sobem para o servidor (as mesmas aceitas pela API, ADR 0005). */
export const TABELAS_SINCRONIZADAS = [
  "tarefas",
  "listas",
  "itensChecklist",
  "movs",
  "metas",
] as const;
export type TabelaSincronizada = (typeof TABELAS_SINCRONIZADAS)[number];
const SINCRONIZADAS = new Set<string>(TABELAS_SINCRONIZADAS);

/** Uma mudança esperando para subir: os campos alterados de um registro e quando. */
export interface EntradaFila {
  seq?: number;
  tabela: TabelaSincronizada;
  registroId: string;
  /** Campo → valor novo; `null` quando o campo foi removido. */
  campos: Record<string, unknown>;
  alteradoEm: string;
}

/**
 * Marca interna para gravações que vieram do servidor: o middleware tira a marca antes de gravar
 * e não as coloca na fila (senão voltariam para o servidor).
 */
export const MARCA_REMOTA = "__remoto";

type Registro = Record<string, unknown> & { id?: string };

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Campos que mudaram de `antes` para `depois` (o id nunca entra). Removido vira `null`. */
export function camposAlterados(
  antes: Registro | undefined,
  depois: Registro,
): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(depois)) {
    if (k === "id" || v === undefined) continue;
    if (!antes || !igual(antes[k], v)) campos[k] = v;
  }
  if (antes) {
    for (const k of Object.keys(antes)) {
      if (k !== "id" && antes[k] !== undefined && depois[k] === undefined) campos[k] = null;
    }
  }
  return campos;
}

function chavesDoPedido(req: DBCoreMutateRequest): unknown[] | null {
  if (req.type !== "add" && req.type !== "put") return null;
  if (req.keys) return req.keys;
  if (req.type === "put" && req.updates) return req.updates.keys;
  return req.values.map((v: Registro) => v.id);
}

function tabelaComFila(tabela: DBCoreTable, down: DBCore): DBCoreTable {
  return {
    ...tabela,
    async mutate(req) {
      if (req.type !== "add" && req.type !== "put") return tabela.mutate(req);

      // Veio do servidor? Só grava, sem a marca e sem fila.
      if (req.values.some((v: Registro) => v?.[MARCA_REMOTA])) {
        const values = req.values.map((v: Registro) => {
          const { [MARCA_REMOTA]: _marca, ...resto } = v;
          return resto;
        });
        return tabela.mutate({ ...req, values });
      }

      // Pedido com critério (modify em lote sem chaves): sem como comparar antes, deixa passar.
      const chaves = chavesDoPedido(req);
      if (!chaves || chaves.some((k) => k === undefined)) return tabela.mutate(req);

      const antes: Array<Registro | undefined> = await tabela.getMany({
        trans: req.trans,
        keys: chaves,
      });
      const res = await tabela.mutate(req);
      const depois: Array<Registro | undefined> = await tabela.getMany({
        trans: req.trans,
        keys: chaves,
      });

      const agora = new Date().toISOString();
      const entradas: EntradaFila[] = [];
      depois.forEach((d, i) => {
        if (!d) return;
        const campos = camposAlterados(antes[i], d);
        if (Object.keys(campos).length) {
          entradas.push({
            tabela: tabela.name as TabelaSincronizada,
            registroId: String(d.id ?? chaves[i]),
            campos,
            alteradoEm: agora,
          });
        }
      });
      if (entradas.length) {
        await down.table("fila").mutate({ type: "add", trans: req.trans, values: entradas });
      }
      return res;
    },
  };
}

/** Middleware a registrar com `db.use(middlewareDaFila)` antes de abrir o banco. */
export const middlewareDaFila: Middleware<DBCore> = {
  stack: "dbcore",
  name: "fila-de-sync",
  create(down) {
    return {
      ...down,
      // Toda transação de escrita numa tabela sincronizada passa a incluir a `fila`.
      transaction(stores, modo, opcoes) {
        const precisa = modo === "readwrite" && stores.some((s) => SINCRONIZADAS.has(s));
        const escopo = precisa && !stores.includes("fila") ? [...stores, "fila"] : stores;
        return down.transaction(escopo, modo, opcoes);
      },
      table(nome) {
        const t = down.table(nome);
        return SINCRONIZADAS.has(nome) ? tabelaComFila(t, down) : t;
      },
    };
  },
};
