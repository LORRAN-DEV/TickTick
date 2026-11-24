/**
 * Banco local (IndexedDB via Dexie) das finanças.
 *
 * Toda leitura e escrita da tela passa por aqui; nada depende de rede.
 * Segue as regras de dados do plano para o sync futuro: id UUID v7 gerado no aparelho,
 * criadoEm/atualizadoEm em ISO, e exclusão lógica (excluidoEm) em vez de apagar.
 */
import Dexie, { type EntityTable } from "dexie";
import { uuidv7, type Meta, type Mov } from "@ticktick/core";
import { gerarExemplos } from "./exemplos";

type Config = { chave: string; valor: unknown };

export class FinancasDB extends Dexie {
  movs!: EntityTable<Mov, "id">;
  metas!: EntityTable<Meta, "id">;
  config!: EntityTable<Config, "chave">;

  constructor(nome = "ticktick") {
    super(nome);
    this.version(1).stores({
      movs: "id, data, tipo, status, atualizadoEm",
      metas: "id, atualizadoEm",
      config: "chave",
    });
  }
}

export const db = new FinancasDB();

const agoraISO = () => new Date().toISOString();
const ativo = (x: { excluidoEm?: string | undefined }) => !x.excluidoEm;

export type NovaMov = Omit<Mov, "id" | "criadoEm" | "atualizadoEm" | "excluidoEm">;
export type NovaMeta = Omit<Meta, "id" | "criadoEm" | "atualizadoEm" | "excluidoEm">;

export function listarMovs(banco: FinancasDB = db): Promise<Mov[]> {
  return banco.movs.filter(ativo).toArray();
}

/** Metas na ordem em que foram criadas (o id v7 ordena pelo tempo). */
export function listarMetas(banco: FinancasDB = db): Promise<Meta[]> {
  return banco.metas.filter(ativo).toArray();
}

export async function adicionarMov(nova: NovaMov, banco: FinancasDB = db): Promise<Mov> {
  const agora = agoraISO();
  const mov: Mov = { ...nova, id: uuidv7(), criadoEm: agora, atualizadoEm: agora };
  await banco.movs.add(mov);
  return mov;
}

export async function alternarPago(id: string, banco: FinancasDB = db): Promise<void> {
  await banco.movs
    .where("id")
    .equals(id)
    .modify((m) => {
      m.status = m.status === "pago" ? "pendente" : "pago";
      m.atualizadoEm = agoraISO();
    });
}

export async function excluirMov(id: string, banco: FinancasDB = db): Promise<void> {
  const agora = agoraISO();
  await banco.movs.update(id, { excluidoEm: agora, atualizadoEm: agora });
}

export async function adicionarMeta(nova: NovaMeta, banco: FinancasDB = db): Promise<Meta> {
  const agora = agoraISO();
  const meta: Meta = { ...nova, id: uuidv7(), criadoEm: agora, atualizadoEm: agora };
  await banco.metas.add(meta);
  return meta;
}

export async function aportarMeta(
  id: string,
  valor: number,
  banco: FinancasDB = db,
): Promise<void> {
  await banco.metas
    .where("id")
    .equals(id)
    .modify((m) => {
      m.atual += valor;
      m.atualizadoEm = agoraISO();
    });
}

export async function excluirMeta(id: string, banco: FinancasDB = db): Promise<void> {
  const agora = agoraISO();
  await banco.metas.update(id, { excluidoEm: agora, atualizadoEm: agora });
}

/** "Começar do zero": marca tudo como excluído. */
export async function limparTudo(banco: FinancasDB = db): Promise<void> {
  const agora = agoraISO();
  await banco.transaction("rw", banco.movs, banco.metas, async () => {
    await banco.movs.filter(ativo).modify({ excluidoEm: agora, atualizadoEm: agora });
    await banco.metas.filter(ativo).modify({ excluidoEm: agora, atualizadoEm: agora });
  });
}

/**
 * Na primeira abertura grava os dados de exemplo. Só acontece uma vez por aparelho:
 * depois de "Começar do zero", os exemplos não voltam.
 */
export async function semearSeNecessario(
  banco: FinancasDB = db,
  hoje: Date = new Date(),
): Promise<boolean> {
  return banco.transaction("rw", banco.movs, banco.metas, banco.config, async () => {
    if (await banco.config.get("exemplosGravados")) return false;
    const { movs, metas } = gerarExemplos(hoje);
    const agora = agoraISO();
    // Um instante por registro: o id v7 começa pelo tempo, então a ordem de criação se mantém.
    const base = Date.now();
    const meta = (i: number) => ({ id: uuidv7(base + i), criadoEm: agora, atualizadoEm: agora });
    await banco.movs.bulkAdd(movs.map((m, i) => ({ ...m, ...meta(i) })));
    await banco.metas.bulkAdd(metas.map((m, i) => ({ ...m, ...meta(movs.length + i) })));
    await banco.config.put({ chave: "exemplosGravados", valor: agora });
    return true;
  });
}
