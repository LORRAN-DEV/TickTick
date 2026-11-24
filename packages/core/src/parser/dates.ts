/**
 * Datas de calendário "puras" no formato YYYY-MM-DD, sem fuso horário.
 *
 * O parser trabalha só com datas locais: "amanhã" é o dia seguinte no
 * calendário do usuário, não 24h depois de agora em UTC. A conversão para
 * UTC acontece depois, quando a tarefa é salva com o fuso dela.
 */
export type PlainDate = string;

/** Dia da semana: 0 = domingo ... 6 = sábado (mesma convenção do JS). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function parts(d: PlainDate): [number, number, number] {
  const [y, m, day] = d.split("-").map(Number);
  if (y === undefined || m === undefined || day === undefined) {
    throw new Error(`Data inválida: ${d}`);
  }
  return [y, m, day];
}

function toUTC(d: PlainDate): Date {
  const [y, m, day] = parts(d);
  return new Date(Date.UTC(y, m - 1, day));
}

function fromUTC(dt: Date): PlainDate {
  return dt.toISOString().slice(0, 10);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monta uma data válida ou devolve null (ex.: 31/02). */
export function makeDate(year: number, month: number, day: number): PlainDate | null {
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(d: PlainDate, n: number): PlainDate {
  const dt = toUTC(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

/** Soma meses mantendo o dia, limitado ao fim do mês (31/01 + 1 mês = 28/02). */
export function addMonths(d: PlainDate, n: number): PlainDate {
  const [y, m, day] = parts(d);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeDate(ny, nm, Math.min(day, daysInMonth(ny, nm))) as PlainDate;
}

export function weekdayOf(d: PlainDate): Weekday {
  return toUTC(d).getUTCDay() as Weekday;
}

export function lastDayOfMonth(d: PlainDate): PlainDate {
  const [y, m] = parts(d);
  return makeDate(y, m, daysInMonth(y, m)) as PlainDate;
}

export function yearOf(d: PlainDate): number {
  return parts(d)[0];
}

export function monthOf(d: PlainDate): number {
  return parts(d)[1];
}

export function dayOf(d: PlainDate): number {
  return parts(d)[2];
}

/**
 * Próxima data cujo dia da semana está em `days`.
 * `includeToday` decide se a própria data `from` pode ser a resposta.
 */
export function nextWeekday(from: PlainDate, days: readonly Weekday[], includeToday: boolean): PlainDate {
  for (let i = includeToday ? 0 : 1; i <= 7; i++) {
    const candidate = addDays(from, i);
    if (days.includes(weekdayOf(candidate))) return candidate;
  }
  throw new Error("Lista de dias da semana vazia");
}

/** Data e hora locais de `now` no fuso `timeZone` (ex.: America/Sao_Paulo). */
export function localNow(now: Date, timeZone: string): { date: PlainDate; time: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    fmt.formatToParts(now).find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
