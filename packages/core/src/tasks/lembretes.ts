/**
 * Lembretes da tarefa (ADR 0008): `lembretes: [{ antes: minutos }]`.
 * Referência: data + hora da tarefa (sem hora, 09:00); o servidor dispara em referência − antes.
 */

export interface Lembrete {
  /** Minutos antes da hora da tarefa (0 = na hora). */
  antes: number;
}

/** Opções da tela, em minutos. */
export const LEMBRETES_PRONTOS = [0, 5, 15, 30, 60, 1440] as const;

/** Horário de referência de tarefa sem hora (igual ao servidor). */
export const HORA_LEMBRETE_SEM_HORA = "09:00";

export function descreverLembrete(antes: number): string {
  if (antes === 0) return "na hora";
  if (antes % 1440 === 0) return antes === 1440 ? "1 dia antes" : `${antes / 1440} dias antes`;
  if (antes % 60 === 0) return antes === 60 ? "1 h antes" : `${antes / 60} h antes`;
  return `${antes} min antes`;
}

/** Só inteiros de 0 a 7 dias, sem repetir, do mais perto ao mais longe da hora. */
export function normalizarLembretes(lembretes: readonly unknown[] | null | undefined): Lembrete[] {
  const vistos = new Set<number>();
  for (const l of lembretes ?? []) {
    const antes = (l as Partial<Lembrete> | null)?.antes;
    if (typeof antes === "number" && Number.isInteger(antes) && antes >= 0 && antes <= 7 * 1440) vistos.add(antes);
  }
  return [...vistos].sort((a, b) => a - b).map((antes) => ({ antes }));
}

/** Liga ou desliga uma opção na lista. */
export function alternarLembrete(lembretes: readonly Lembrete[] | undefined, antes: number): Lembrete[] {
  const atual = normalizarLembretes(lembretes);
  return atual.some((l) => l.antes === antes)
    ? atual.filter((l) => l.antes !== antes)
    : normalizarLembretes([...atual, { antes }]);
}
