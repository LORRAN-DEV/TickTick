/** Operações de tarefas e listas no banco local (ver `banco.ts`). */
import {
  concluir,
  dadosDoQuickAdd,
  hojeLocal,
  INBOX_ID,
  parseQuickAdd,
  uuidv7,
  type Lista,
  type StatusTarefa,
  type Tarefa,
} from "@ticktick/core";
import { agoraISO, ativo, db, type TickTickDB } from "./banco";

/** Cria a Inbox se ainda não existir (id fixo, igual em todos os aparelhos). */
export async function garantirInbox(banco: TickTickDB = db): Promise<void> {
  if (await banco.listas.get(INBOX_ID)) return;
  const agora = agoraISO();
  await banco.listas.put({
    id: INBOX_ID,
    nome: "Inbox",
    ordem: "0",
    criadoEm: agora,
    atualizadoEm: agora,
  });
}

/** Listas ativas: Inbox primeiro, depois na ordem de criação. */
export async function listarListas(banco: TickTickDB = db): Promise<Lista[]> {
  const ls = await banco.listas.filter(ativo).toArray();
  return ls.sort((a, b) =>
    a.id === INBOX_ID ? -1 : b.id === INBOX_ID ? 1 : a.ordem.localeCompare(b.ordem),
  );
}

/** Todas as tarefas, inclusive as da lixeira (a tela filtra com as funções do core). */
export function listarTarefas(banco: TickTickDB = db): Promise<Tarefa[]> {
  return banco.tarefas.toArray();
}

/** Acha uma lista ativa pelo nome (sem diferenciar maiúsculas) ou cria. */
async function listaPorNome(nome: string, banco: TickTickDB): Promise<string> {
  const alvo = nome.trim().toLocaleLowerCase("pt-BR");
  const existente = await banco.listas
    .filter((l) => ativo(l) && l.nome.toLocaleLowerCase("pt-BR") === alvo)
    .first();
  if (existente) return existente.id;
  const agora = agoraISO();
  const id = uuidv7();
  await banco.listas.add({
    id,
    nome: nome.trim(),
    ordem: agora,
    criadoEm: agora,
    atualizadoEm: agora,
  });
  return id;
}

export class TituloVazioError extends Error {
  constructor() {
    super("A tarefa precisa de um título");
  }
}

/**
 * Cria uma tarefa a partir do texto do quick-add. Sem `~lista`, vai para `listaPadrao`
 * (a lista aberta na tela) ou para a Inbox.
 */
export async function criarDoTexto(
  texto: string,
  opcoes: { agora?: Date; listaPadrao?: string; banco?: TickTickDB } = {},
): Promise<Tarefa> {
  const banco = opcoes.banco ?? db;
  const p = parseQuickAdd(texto, { now: opcoes.agora ?? new Date() });
  if (!p.title.trim()) throw new TituloVazioError();
  return banco.transaction("rw", banco.tarefas, banco.listas, async () => {
    await garantirInbox(banco);
    const listaId = p.list ? await listaPorNome(p.list, banco) : (opcoes.listaPadrao ?? INBOX_ID);
    const agora = agoraISO();
    const tarefa: Tarefa = {
      ...dadosDoQuickAdd(p),
      id: uuidv7(),
      status: "aberta",
      listaId,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    await banco.tarefas.add(tarefa);
    return tarefa;
  });
}

/** Concluir ou "não vou fazer". Recorrente: avança para a próxima data e guarda uma cópia no histórico. */
export async function concluirTarefa(
  id: string,
  como: Exclude<StatusTarefa, "aberta"> = "concluida",
  banco: TickTickDB = db,
  agora: Date = new Date(),
): Promise<void> {
  await banco.transaction("rw", banco.tarefas, async () => {
    const t = await banco.tarefas.get(id);
    if (!t || t.status !== "aberta") return;
    const r = concluir(t, agora.toISOString(), hojeLocal(agora), como);
    await banco.tarefas.put(r.tarefa);
    if (r.copiaConcluida) await banco.tarefas.add({ ...r.copiaConcluida, id: uuidv7() });
  });
}

export async function reabrirTarefa(id: string, banco: TickTickDB = db): Promise<void> {
  await banco.tarefas.update(id, {
    status: "aberta",
    concluidaEm: undefined,
    atualizadoEm: agoraISO(),
  });
}

export async function moverParaLixeira(id: string, banco: TickTickDB = db): Promise<void> {
  const agora = agoraISO();
  await banco.tarefas.update(id, { excluidoEm: agora, atualizadoEm: agora });
}

export async function restaurarTarefa(id: string, banco: TickTickDB = db): Promise<void> {
  await banco.tarefas.update(id, { excluidoEm: undefined, atualizadoEm: agoraISO() });
}
