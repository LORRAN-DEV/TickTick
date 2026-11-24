/**
 * Próxima ocorrência de uma regra RRULE (RFC 5545), em datas locais.
 *
 * Cobre as regras que o quick-add gera: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY com INTERVAL,
 * WEEKLY com BYDAY e MONTHLY com BYMONTHDAY. A data-base faz o papel do DTSTART.
 */
import {
  addDays,
  addMonths,
  daysInMonth,
  makeDate,
  monthOf,
  weekdayOf,
  yearOf,
  type PlainDate,
  type Weekday,
} from "../parser/dates.ts";

export type Frequencia = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface Regra {
  freq: Frequencia;
  intervalo: number;
  diasDaSemana: Weekday[];
  diaDoMes: number | null;
}

const BYDAY: Record<string, Weekday> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Lê uma RRULE. Devolve null se tiver algo que não sabemos calcular (melhor recusar que errar a data). */
export function lerRegra(rrule: string): Regra | null {
  const partes = new Map<string, string>();
  for (const p of rrule.replace(/^RRULE:/i, "").split(";")) {
    const [k, v] = p.split("=");
    if (!k || v === undefined) return null;
    partes.set(k.toUpperCase(), v.toUpperCase());
  }
  const freq = partes.get("FREQ");
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null;
  for (const k of partes.keys()) if (!["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "WKST"].includes(k)) return null;

  const intervalo = Number(partes.get("INTERVAL") ?? "1");
  if (!Number.isInteger(intervalo) || intervalo < 1) return null;

  const diasDaSemana: Weekday[] = [];
  const byday = partes.get("BYDAY");
  if (byday) {
    if (freq !== "WEEKLY") return null;
    for (const d of byday.split(",")) {
      const w = BYDAY[d];
      if (w === undefined) return null; // ex.: "1MO" (primeira segunda) não é suportado
      diasDaSemana.push(w);
    }
  }

  let diaDoMes: number | null = null;
  const bymonthday = partes.get("BYMONTHDAY");
  if (bymonthday) {
    diaDoMes = Number(bymonthday);
    if (freq !== "MONTHLY" || !Number.isInteger(diaDoMes) || diaDoMes < 1 || diaDoMes > 31) return null;
  }
  return { freq, intervalo, diasDaSemana, diaDoMes };
}

/** Segunda-feira da semana de `d` (semanas começam na segunda, WKST=MO). */
function inicioDaSemana(d: PlainDate): PlainDate {
  return addDays(d, -((weekdayOf(d) + 6) % 7));
}

/**
 * Primeira ocorrência estritamente depois de `base`, contando os intervalos a partir de `base`.
 * Devolve null se a regra não for suportada.
 */
export function proximaOcorrencia(rrule: string, base: PlainDate): PlainDate | null {
  const r = lerRegra(rrule);
  if (!r) return null;
  switch (r.freq) {
    case "DAILY":
      return addDays(base, r.intervalo);
    case "YEARLY":
      return addMonths(base, 12 * r.intervalo);
    case "WEEKLY": {
      if (r.diasDaSemana.length === 0) return addDays(base, 7 * r.intervalo);
      const dias = [...r.diasDaSemana].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // seg..dom
      const semana = inicioDaSemana(base);
      // Ainda nesta semana, depois da base?
      for (const w of dias) {
        const c = addDays(semana, (w + 6) % 7);
        if (c > base) return c;
      }
      // Senão, o primeiro dia da semana seguinte válida.
      return addDays(addDays(semana, 7 * r.intervalo), (dias[0]! + 6) % 7);
    }
    case "MONTHLY": {
      if (r.diaDoMes === null) return addMonths(base, r.intervalo);
      // Meses sem esse dia (ex.: 31 em abril) são pulados, como manda a RFC 5545.
      let y = yearOf(base);
      let m = monthOf(base);
      for (let i = 0; i < 48; i++) {
        if (i % r.intervalo === 0 && r.diaDoMes <= daysInMonth(y, m)) {
          const c = makeDate(y, m, r.diaDoMes)!;
          if (c > base) return c;
        }
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
      }
      return null;
    }
  }
}

/** Descrição curta em português para mostrar na tela ("toda seg, qua", "a cada 2 semanas"). */
export function descreverRegra(rrule: string): string {
  const r = lerRegra(rrule);
  if (!r) return "repete";
  const NOMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const n = r.intervalo;
  switch (r.freq) {
    case "DAILY":
      return n === 1 ? "todo dia" : `a cada ${n} dias`;
    case "WEEKLY": {
      const dias = r.diasDaSemana;
      if (dias.length === 5 && [1, 2, 3, 4, 5].every((d) => dias.includes(d as Weekday))) return "dias úteis";
      if (dias.length) return (n === 1 ? "toda " : `a cada ${n} semanas: `) + dias.map((d) => NOMES[d]).join(", ");
      return n === 1 ? "toda semana" : `a cada ${n} semanas`;
    }
    case "MONTHLY":
      return (n === 1 ? "todo mês" : `a cada ${n} meses`) + (r.diaDoMes ? ` no dia ${r.diaDoMes}` : "");
    case "YEARLY":
      return n === 1 ? "todo ano" : `a cada ${n} anos`;
  }
}
