/** Operações de tarefas e listas no banco local (ver `banco.ts`). */
import {
  concluirComDescendentes,
  lixeiraComDescendentes,
  moverDescendentesDeLista,
  NIVEL_MAXIMO,
  podeTerSubtarefa,
  restaurarComDescendentes,
  dadosDoQuickAdd,
  editarTarefa,
  hojeLocal,
  INBOX_ID,
  parseQuickAdd,
  uuidv7,
  TituloVazioError,
  type Lista,
  type MudancasTarefa,
  type StatusTarefa,
  type Tarefa,
} from "@ticktick/core";
import { agoraISO, ativo, db, type TickTickDB } from "./banco";

export { TituloVazioError };

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

/** Concluir ou "não vou fazer", com as subtarefas (regras em `concluirComDescendentes` do core). */
export async function concluirTarefa(
  id: string,
  como: Exclude<StatusTarefa, "aberta"> = "concluida",
  banco: TickTickDB = db,
  agora: Date = new Date(),
): Promise<void> {
  await banco.transaction("rw", banco.tarefas, banco.itensChecklist, async () => {
    const todas = await banco.tarefas.toArray();
    const iso = agora.toISOString();
    const r = concluirComDescendentes(todas, id, iso, hojeLocal(agora), como);
    if (!r.alteradas.length) return;
    await banco.tarefas.bulkPut(r.alteradas);
    if (r.novas.length) await banco.tarefas.bulkAdd(r.novas.map((n) => ({ ...n, id: uuidv7() })));
    if (r.reiniciarChecklistDe.length) {
      await banco.itensChecklist
        .where("tarefaId")
        .anyOf(r.reiniciarChecklistDe)
        .filter((i) => i.feito && !i.excluidoEm)
        .modify({ feito: false, atualizadoEm: iso });
    }
  });
}

export async function reabrirTarefa(id: string, banco: TickTickDB = db): Promise<void> {
  await banco.tarefas.update(id, {
    status: "aberta",
    concluidaEm: undefined,
    atualizadoEm: agoraISO(),
  });
}

/** Lixeira, levando as subtarefas junto. */
export async function moverParaLixeira(id: string, banco: TickTickDB = db): Promise<void> {
  await banco.transaction("rw", banco.tarefas, async () => {
    await banco.tarefas.bulkPut(
      lixeiraComDescendentes(await banco.tarefas.toArray(), id, agoraISO()),
    );
  });
}

/** Restaura a tarefa e as subtarefas que foram para a lixeira junto com ela. */
export async function restaurarTarefa(id: string, banco: TickTickDB = db): Promise<void> {
  await banco.transaction("rw", banco.tarefas, async () => {
    await banco.tarefas.bulkPut(
      restaurarComDescendentes(await banco.tarefas.toArray(), id, agoraISO()),
    );
  });
}

/**
 * Edita uma tarefa (regras em `editarTarefa` do core). Lança TituloVazioError/HoraInvalidaError
 * sem gravar nada. Mudou de lista? As subtarefas vão junto. Devolve a tarefa como ficou.
 */
export async function atualizarTarefa(
  id: string,
  mudancas: MudancasTarefa,
  banco: TickTickDB = db,
  agora: Date = new Date(),
): Promise<Tarefa> {
  return banco.transaction("rw", banco.tarefas, async () => {
    const t = await banco.tarefas.get(id);
    if (!t) throw new Error(`Tarefa não encontrada: ${id}`);
    const iso = agora.toISOString();
    const nova = editarTarefa(t, mudancas, iso, hojeLocal(agora));
    await banco.tarefas.put(nova);
    if (nova.listaId !== t.listaId) {
      const todas = await banco.tarefas.toArray();
      await banco.tarefas.bulkPut(moverDescendentesDeLista(todas, id, nova.listaId, iso));
    }
    return nova;
  });
}

export class NivelMaximoError extends Error {
  constructor() {
    super(`Subtarefas vão até o ${NIVEL_MAXIMO}º nível`);
    this.name = "NivelMaximoError";
  }
}

/** Cria uma subtarefa pelo texto do quick-add. Fica na lista da mãe (um `~lista` no texto é ignorado). */
export async function criarSubtarefa(
  paiId: string,
  texto: string,
  opcoes: { agora?: Date; banco?: TickTickDB } = {},
): Promise<Tarefa> {
  const banco = opcoes.banco ?? db;
  const p = parseQuickAdd(texto, { now: opcoes.agora ?? new Date() });
  if (!p.title.trim()) throw new TituloVazioError();
  return banco.transaction("rw", banco.tarefas, async () => {
    const todas = await banco.tarefas.toArray();
    const pai = todas.find((x) => x.id === paiId);
    if (!pai) throw new Error(`Tarefa não encontrada: ${paiId}`);
    if (!podeTerSubtarefa(todas, pai)) throw new NivelMaximoError();
    const agora = agoraISO();
    const sub: Tarefa = {
      ...dadosDoQuickAdd(p),
      id: uuidv7(),
      status: "aberta",
      listaId: pai.listaId,
      paiId,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    await banco.tarefas.add(sub);
    return sub;
  });
}
