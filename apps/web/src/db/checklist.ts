/** Operações do checklist de uma tarefa no banco local (ver `banco.ts`). */
import { TituloVazioError, uuidv7, type ItemChecklist } from "@ticktick/core";
import { agoraISO, ativo, db, type TickTickDB } from "./banco";

export function listarItens(banco: TickTickDB = db): Promise<ItemChecklist[]> {
  return banco.itensChecklist.filter(ativo).toArray();
}

/** Novo item no fim do checklist (o id v7 segue a ordem de criação e serve de `ordem`). */
export async function adicionarItem(
  tarefaId: string,
  titulo: string,
  banco: TickTickDB = db,
): Promise<ItemChecklist> {
  const t = titulo.trim();
  if (!t) throw new TituloVazioError();
  const agora = agoraISO();
  const id = uuidv7();
  const item: ItemChecklist = {
    id,
    tarefaId,
    titulo: t,
    feito: false,
    ordem: id,
    criadoEm: agora,
    atualizadoEm: agora,
  };
  await banco.itensChecklist.add(item);
  return item;
}

export async function alternarItem(id: string, banco: TickTickDB = db): Promise<void> {
  await banco.itensChecklist
    .where("id")
    .equals(id)
    .modify((i) => {
      i.feito = !i.feito;
      i.atualizadoEm = agoraISO();
    });
}

export async function renomearItem(
  id: string,
  titulo: string,
  banco: TickTickDB = db,
): Promise<void> {
  const t = titulo.trim();
  if (!t) throw new TituloVazioError();
  await banco.itensChecklist.update(id, { titulo: t, atualizadoEm: agoraISO() });
}

export async function removerItem(id: string, banco: TickTickDB = db): Promise<void> {
  const agora = agoraISO();
  await banco.itensChecklist.update(id, { excluidoEm: agora, atualizadoEm: agora });
}
