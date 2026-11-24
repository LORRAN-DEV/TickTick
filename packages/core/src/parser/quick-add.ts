/**
 * Quick-add: transforma "pagar boleto sexta 10h !alta #casa" numa tarefa.
 *
 * Como funciona:
 * 1. O texto é normalizado (minúsculas, sem acento) mantendo o mesmo
 *    comprimento, para que as posições encontradas valham no texto original.
 * 2. As regras rodam numa ordem fixa: marcadores (#tag, ~lista, !prioridade),
 *    recorrência, datas, horas. Um trecho já reconhecido não é reaproveitado.
 * 3. O que sobra vira o título.
 *
 * Tudo é puro e sem dependências: roda igual no navegador e no servidor.
 */
import {
  addDays,
  addMonths,
  lastDayOfMonth,
  localNow,
  makeDate,
  monthOf,
  nextWeekday,
  yearOf,
  type PlainDate,
  type Weekday,
} from "./dates.ts";

export type Priority = 0 | 1 | 2 | 3; // nenhuma, baixa, média, alta
export type MatchKind = "date" | "time" | "recurrence" | "priority" | "tag" | "list";

/** Trecho reconhecido, para destacar no campo enquanto o usuário digita. */
export interface Match {
  kind: MatchKind;
  start: number;
  end: number;
  text: string;
}

export interface ParsedTask {
  title: string;
  /** Data local YYYY-MM-DD, ou null se não houver. */
  date: PlainDate | null;
  /** Hora local HH:MM, ou null para tarefa de dia inteiro. */
  time: string | null;
  priority: Priority;
  tags: string[];
  list: string | null;
  /** Regra de repetição RFC 5545, sem DTSTART (ex.: "FREQ=WEEKLY;BYDAY=MO"). */
  rrule: string | null;
  matches: Match[];
}

export interface PeriodDefaults {
  manha: string;
  tarde: string;
  noite: string;
}

/** Horário usado quando o texto diz só o período ("de manhã"). */
export const DEFAULT_PERIODS: PeriodDefaults = { manha: "09:00", tarde: "15:00", noite: "20:00" };

export interface ParseOptions {
  /** Momento de referência. Padrão: agora. */
  now?: Date;
  /** Fuso do usuário. Padrão: o fuso do ambiente. */
  timeZone?: string;
  periods?: Partial<PeriodDefaults>;
}

// ---------------------------------------------------------------------------
// Vocabulário (sempre sem acento, porque casa com o texto normalizado)

const END = String.raw`(?=$|[\s,.;:!?)])`;
/** Até duas palavras de ligação antes de uma data: "para a", "até o", "na"... */
const PREP = String.raw`(?:(?:para|pra|ate|no|na|nesta|neste|nessa|nesse|esta|este|essa|esse|o|a|em)\s+){0,2}`;

const WEEKDAYS: Record<string, Weekday> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};
const WD = Object.keys(WEEKDAYS).join("|");
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

// Abreviações ambíguas (mar, mai, set, out) ficam de fora: "2 set de pratos".
const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, abril: 4, abr: 4, maio: 5,
  junho: 6, jun: 6, julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, outubro: 10,
  novembro: 11, nov: 11, dezembro: 12, dez: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
  oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30,
};
const NUM = String.raw`\d{1,3}|` + Object.keys(NUMBER_WORDS).join("|");
const UNIT = String.raw`dias?|semanas?|mes|meses|anos?`;

const SIMPLE_RECURRENCE: Record<string, string> = {
  "todo dia": "DAILY",
  "todos os dias": "DAILY",
  diariamente: "DAILY",
  "toda semana": "WEEKLY",
  "todas as semanas": "WEEKLY",
  semanalmente: "WEEKLY",
  "todo mes": "MONTHLY",
  "todos os meses": "MONTHLY",
  mensalmente: "MONTHLY",
  "todo ano": "YEARLY",
  "todos os anos": "YEARLY",
  anualmente: "YEARLY",
};

type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type Period = "manha" | "tarde" | "noite" | "madrugada";

// ---------------------------------------------------------------------------
// Estado de uma análise

interface State {
  text: string;
  n: string;
  consumed: Array<[number, number]>;
  matches: Match[];
  today: PlainDate;
  nowTime: string;
  periods: PeriodDefaults;
  date: PlainDate | null;
  /** true quando a data veio de uma regra (ex.: "todo dia"), não do texto. */
  dateImplicit: boolean;
  /** Próxima ocorrência depois de uma data, para pular horários já passados. */
  next: ((after: PlainDate) => PlainDate) | null;
  time: string | null;
  rrule: string | null;
  priority: Priority;
  tags: string[];
  list: string | null;
}

/** Minúsculas e sem acento, com exatamente o mesmo comprimento do original. */
function normalize(text: string): string {
  let out = "";
  for (const ch of text) {
    let c = ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    if (c.length !== ch.length) {
      const lower = ch.toLowerCase();
      c = lower.length === ch.length ? lower : ch;
    }
    out += c;
  }
  return out;
}

function toNumber(word: string): number {
  return /^\d+$/.test(word) ? Number(word) : (NUMBER_WORDS[word] ?? Number.NaN);
}

/** Texto depois de `end`, com os trechos já reconhecidos trocados por espaços. */
function after(s: State, end: number): string {
  let out = s.n.slice(end);
  for (const [a, b] of s.consumed) {
    const from = Math.max(a, end) - end;
    const to = b - end;
    if (to > from) out = out.slice(0, from) + " ".repeat(to - from) + out.slice(to);
  }
  return out;
}

/** O que vem depois parece fim de frase ou outro marcador? */
const BOUNDARY_AFTER = /^\s*(?:$|[,.;:!?)#!~])/;

function scan(
  s: State,
  re: RegExp,
  kind: MatchKind,
  handle: (m: RegExpMatchArray, start: number, end: number) => boolean,
): void {
  for (const m of s.n.matchAll(re)) {
    const index = m.index ?? 0;
    const start = index + (m[1] ?? "").length;
    const end = index + m[0].length;
    if (s.consumed.some(([a, b]) => start < b && end > a)) continue;
    if (!handle(m, start, end)) continue;
    s.consumed.push([start, end]);
    s.matches.push({ kind, start, end, text: s.text.slice(start, end) });
  }
}

const canSetDate = (s: State): boolean => s.date === null || s.dateImplicit;

function setDate(s: State, d: PlainDate): void {
  s.date = d;
  s.dateImplicit = false;
}

function setRecurrence(s: State, rrule: string, first: PlainDate, next: (after: PlainDate) => PlainDate): void {
  s.rrule = rrule;
  if (s.date === null) {
    s.date = first;
    s.dateImplicit = true;
  }
  s.next = next;
}

/** Próxima data com o dia do mês `day` (pula meses que não têm esse dia). */
function nextMonthDay(from: PlainDate, day: number, includeToday: boolean): PlainDate | null {
  let y = yearOf(from);
  let m = monthOf(from);
  for (let i = 0; i < 24; i++) {
    const candidate = makeDate(y, m, day);
    if (candidate && (candidate > from || (includeToday && candidate === from))) return candidate;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return null;
}

/** Data sem ano: este ano, ou o próximo se já passou. */
function withRollover(s: State, month: number, day: number, year: number | null): PlainDate | null {
  if (year !== null) return makeDate(year, month, day);
  const thisYear = makeDate(yearOf(s.today), month, day);
  if (thisYear && thisYear >= s.today) return thisYear;
  return makeDate(yearOf(s.today) + 1, month, day);
}

function addUnits(d: PlainDate, n: number, unit: string): PlainDate {
  if (unit.startsWith("dia")) return addDays(d, n);
  if (unit.startsWith("semana")) return addDays(d, 7 * n);
  if (unit.startsWith("mes")) return addMonths(d, n);
  return addMonths(d, 12 * n);
}

function freqOf(unit: string): Freq {
  if (unit.startsWith("dia")) return "DAILY";
  if (unit.startsWith("semana")) return "WEEKLY";
  if (unit.startsWith("mes")) return "MONTHLY";
  return "YEARLY";
}

function fmtTime(h: number, min: number): string | null {
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function withPeriod(h: number, period: Period | undefined): number {
  if (period === "tarde" || period === "noite") return h === 12 && period === "noite" ? 0 : h < 12 ? h + 12 : h;
  if (period === "madrugada" && h === 12) return 0;
  return h;
}

// ---------------------------------------------------------------------------
// Regras

function markers(s: State): void {
  scan(s, /(^|\s)#([\p{L}\p{N}_/-]+)/gu, "tag", (_m, start, end) => {
    const tag = s.text.slice(start + 1, end).toLowerCase();
    if (!s.tags.includes(tag)) s.tags.push(tag);
    return true;
  });

  scan(s, /(^|\s)~([\p{L}\p{N}_/-]+)/gu, "list", (_m, start, end) => {
    if (s.list !== null) return false;
    s.list = s.text.slice(start + 1, end);
    return true;
  });

  scan(s, new RegExp(String.raw`(^|\s)!(alta|media|baixa|[1-3])${END}`, "g"), "priority", (m) => {
    if (s.priority !== 0) return false;
    const v = m[2] ?? "";
    s.priority = v === "alta" || v === "3" ? 3 : v === "media" || v === "2" ? 2 : 1;
    return true;
  });
}

function recurrence(s: State): void {
  // "toda segunda", "todas as terças e quintas", "toda segunda, quarta e sexta"
  const item = String.raw`(?:${WD})s?(?:-feiras?|\s+feiras?)?`;
  const weekdayList = new RegExp(
    String.raw`(^|\s)tod[ao]s?\s+(?:as\s+|os\s+)?(${item}(?:\s*(?:,|e)\s*${item})*)${END}`,
    "g",
  );
  scan(s, weekdayList, "recurrence", (m) => {
    if (s.rrule !== null) return false;
    const names = (m[2] ?? "").match(new RegExp(WD, "g")) ?? [];
    const days = [...new Set(names.map((n) => WEEKDAYS[n] as Weekday))].sort((a, b) => a - b);
    setRecurrence(
      s,
      `FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(",")}`,
      nextWeekday(s.today, days, true),
      (d) => nextWeekday(d, days, false),
    );
    return true;
  });

  // "dias úteis", "todo dia útil"
  const workdays = new RegExp(String.raw`(^|\s)(?:tod[oa]s?\s+(?:os\s+)?)?dias?\s+uteis?${END}`, "g");
  scan(s, workdays, "recurrence", () => {
    if (s.rrule !== null) return false;
    const days: Weekday[] = [1, 2, 3, 4, 5];
    setRecurrence(s, "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", nextWeekday(s.today, days, true), (d) =>
      nextWeekday(d, days, false),
    );
    return true;
  });

  // "todo dia 5", "todo dia 10 do mês"
  const monthDay = new RegExp(
    String.raw`(^|\s)tod[oa]\s+(?:o\s+)?dia\s+(\d{1,2})(?:\s+(?:do|de\s+cada)\s+mes)?${END}`,
    "g",
  );
  scan(s, monthDay, "recurrence", (m) => {
    if (s.rrule !== null) return false;
    const day = Number(m[2]);
    const first = day >= 1 && day <= 31 ? nextMonthDay(s.today, day, true) : null;
    if (!first) return false;
    setRecurrence(s, `FREQ=MONTHLY;BYMONTHDAY=${day}`, first, (d) => nextMonthDay(d, day, false) ?? d);
    return true;
  });

  // "a cada 2 semanas", "a cada 3 dias", "a cada mês"
  const interval = new RegExp(String.raw`(^|\s)a\s+cada\s+(?:(${NUM})\s+)?(${UNIT})${END}`, "g");
  scan(s, interval, "recurrence", (m) => {
    if (s.rrule !== null) return false;
    const n = m[2] ? toNumber(m[2]) : 1;
    const unit = m[3] ?? "dia";
    if (!Number.isFinite(n) || n < 1) return false;
    const rule = `FREQ=${freqOf(unit)}` + (n > 1 ? `;INTERVAL=${n}` : "");
    setRecurrence(s, rule, s.today, (d) => addUnits(d, n, unit));
    return true;
  });

  // "todo dia", "toda semana", "mensalmente"...
  const words = Object.keys(SIMPLE_RECURRENCE)
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/ /g, String.raw`\s+`))
    .join("|");
  scan(s, new RegExp(String.raw`(^|\s)(${words})${END}`, "g"), "recurrence", (m) => {
    if (s.rrule !== null) return false;
    const freq = SIMPLE_RECURRENCE[(m[2] ?? "").replace(/\s+/g, " ")] as Freq;
    const step = { DAILY: "dia", WEEKLY: "semana", MONTHLY: "mes", YEARLY: "ano" }[freq];
    setRecurrence(s, `FREQ=${freq}`, s.today, (d) => addUnits(d, 1, step));
    return true;
  });
}

function dates(s: State): void {
  // "hoje", "amanhã", "depois de amanhã"
  const relative = new RegExp(String.raw`(^|\s)${PREP}(depois\s+de\s+amanha|amanha|hoje)${END}`, "g");
  scan(s, relative, "date", (m) => {
    if (!canSetDate(s)) return false;
    const word = (m[2] ?? "").replace(/\s+/g, " ");
    setDate(s, addDays(s.today, word === "hoje" ? 0 : word === "amanha" ? 1 : 2));
    return true;
  });

  // "daqui a 3 dias", "em 2 semanas", "dentro de um mês"
  const inN = new RegExp(String.raw`(^|\s)(?:daqui\s+a|daqui|em|dentro\s+de)\s+(${NUM})\s+(${UNIT})${END}`, "g");
  scan(s, inN, "date", (m) => {
    if (!canSetDate(s)) return false;
    const n = toNumber(m[2] ?? "");
    if (!Number.isFinite(n)) return false;
    setDate(s, addUnits(s.today, n, m[3] ?? "dia"));
    return true;
  });

  // "fim de semana", "fim do mês", "fim do ano"
  const ends = new RegExp(
    String.raw`(^|\s)${PREP}(fim\s+de\s+semana|final\s+de\s+semana|fim\s+do\s+mes|final\s+do\s+mes|fim\s+do\s+ano|final\s+do\s+ano)${END}`,
    "g",
  );
  scan(s, ends, "date", (m) => {
    if (!canSetDate(s)) return false;
    const what = m[2] ?? "";
    if (what.endsWith("semana")) setDate(s, nextWeekday(s.today, [6], true));
    else if (what.endsWith("mes")) setDate(s, lastDayOfMonth(s.today));
    else setDate(s, makeDate(yearOf(s.today), 12, 31) as PlainDate);
    return true;
  });

  // "10 de dezembro", "dia 3 de março de 2027", "15 jan"
  const named = new RegExp(
    String.raw`(^|\s)${PREP}(?:dia\s+)?(\d{1,2})\s+(?:de\s+)?(${MONTH_RE})(?:\s+(?:de\s+)?(\d{4}))?${END}`,
    "g",
  );
  scan(s, named, "date", (m) => {
    if (!canSetDate(s)) return false;
    const d = withRollover(s, MONTHS[m[3] ?? ""] ?? 0, Number(m[2]), m[4] ? Number(m[4]) : null);
    if (!d) return false;
    setDate(s, d);
    return true;
  });

  // "10/12", "dia 10/12/2026", "5/1/27"
  const numeric = new RegExp(
    String.raw`(^|\s)${PREP}(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?${END}`,
    "g",
  );
  scan(s, numeric, "date", (m) => {
    if (!canSetDate(s)) return false;
    let year: number | null = m[4] ? Number(m[4]) : null;
    if (year !== null && year < 100) year += 2000;
    const d = withRollover(s, Number(m[3]), Number(m[2]), year);
    if (!d) return false;
    setDate(s, d);
    return true;
  });

  // "dia 10": este mês, ou o próximo se já passou
  scan(s, new RegExp(String.raw`(^|\s)${PREP}dia\s+(\d{1,2})${END}`, "g"), "date", (m) => {
    if (!canSetDate(s)) return false;
    const d = nextMonthDay(s.today, Number(m[2]), true);
    if (!d) return false;
    setDate(s, d);
    return true;
  });

  // "sexta", "na segunda-feira", "próxima quarta", "sexta que vem"
  const weekday = new RegExp(
    String.raw`(^|\s)(${PREP})(proxim[ao]\s+)?(${WD})(?:-feira|\s+feira)?(\s+que\s+vem)?${END}`,
    "g",
  );
  // Sem "na"/"próxima", só aceita se o que vem depois parece data/hora/fim:
  // "estudar sexta" sim, "segunda prova de cálculo" não.
  const looksTemporal =
    /^\s*(?:$|[,.;:!?)#!~]|(?:as|ate|para)\s+\d|\d{1,2}(?:h|:)|(?:de|pela)\s+manha|(?:a|de|pela)\s+(?:tarde|noite))/;
  scan(s, weekday, "date", (m, _start, end) => {
    if (!canSetDate(s)) return false;
    const explicitNext = Boolean(m[3] || m[5]);
    if (!m[2] && !explicitNext && !looksTemporal.test(after(s, end))) return false;
    const wd = WEEKDAYS[m[4] ?? ""] as Weekday;
    setDate(s, nextWeekday(s.today, [wd], !explicitNext));
    return true;
  });
}

function times(s: State): void {
  const setTime = (t: string | null): boolean => {
    if (s.time !== null || t === null) return false;
    s.time = t;
    return true;
  };

  // "meio-dia", "à meia-noite"
  scan(
    s,
    new RegExp(String.raw`(^|\s)(?:(?:ao|a|as|ate)\s+)?(meio[- ]dia|meia[- ]noite)${END}`, "g"),
    "time",
    (m) => setTime((m[2] ?? "").startsWith("meio") ? "12:00" : "00:00"),
  );

  // "15h", "15h30", "15:30", "às 9h da noite"
  const clock = new RegExp(
    String.raw`(^|\s)((?:as|ate\s+as|para\s+as|a\s+partir\s+das|das)\s+)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?:\s+(?:da|de)\s+(manha|tarde|noite|madrugada))?${END}`,
    "g",
  );
  scan(s, clock, "time", (m) => {
    const h = Number(m[3]);
    const min = Number(m[4] ?? m[5] ?? 0);
    const period = m[6] as Period | undefined;
    // "estudar 2h" é duração, não horário: sem "às" exige hora >= 6, minutos ou período.
    if (!m[2] && h < 6 && !m[4] && !m[5] && !period) return false;
    return setTime(fmtTime(withPeriod(h, period), min));
  });

  // "às 9", "às 3 da tarde", "às 10 horas"
  const atHour = new RegExp(
    String.raw`(^|\s)(?:as|ate\s+as|para\s+as|a\s+partir\s+das|das)\s+(\d{1,2})(\s+horas?)?(?:\s+(?:da|de)\s+(manha|tarde|noite|madrugada))?${END}`,
    "g",
  );
  scan(s, atHour, "time", (m, _start, end) => {
    const period = m[4] as Period | undefined;
    // "levar as 3 meninas" não é horário.
    if (!period && !m[3] && !BOUNDARY_AFTER.test(after(s, end))) return false;
    return setTime(fmtTime(withPeriod(Number(m[2]), period), 0));
  });

  // "3 da tarde", "8 da manhã"
  scan(
    s,
    new RegExp(String.raw`(^|\s)(\d{1,2})\s+(?:da|de)\s+(manha|tarde|noite|madrugada)${END}`, "g"),
    "time",
    (m) => setTime(fmtTime(withPeriod(Number(m[2]), m[3] as Period), 0)),
  );

  // Só o período: "de manhã", "à tarde", "hoje à noite"
  scan(
    s,
    new RegExp(String.raw`(^|\s)(?:de|pela|na|nesta|nessa|esta|essa|a)\s+(manha|tarde|noite)${END}`, "g"),
    "time",
    (m) => setTime(s.periods[(m[2] ?? "manha") as keyof PeriodDefaults]),
  );
}

function buildTitle(s: State): string {
  let out = "";
  for (let i = 0; i < s.text.length; i++) {
    out += s.consumed.some(([a, b]) => i >= a && i < b) ? " " : s.text[i];
  }
  return out
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;:–-]+\s*|\s*[,;:–-]+$/g, "")
    .trim();
}

// ---------------------------------------------------------------------------

export function parseQuickAdd(input: string, options: ParseOptions = {}): ParsedTask {
  const text = input.normalize("NFC");
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { date: today, time: nowTime } = localNow(options.now ?? new Date(), timeZone);

  const s: State = {
    text,
    n: normalize(text),
    consumed: [],
    matches: [],
    today,
    nowTime,
    periods: { ...DEFAULT_PERIODS, ...options.periods },
    date: null,
    dateImplicit: false,
    next: null,
    time: null,
    rrule: null,
    priority: 0,
    tags: [],
    list: null,
  };

  markers(s);
  recurrence(s);
  dates(s);
  times(s);

  // Só a hora, sem data: hoje (ou amanhã, se a hora já passou).
  if (s.time !== null && s.date === null) {
    s.date = today;
    s.dateImplicit = true;
    s.next = (d) => addDays(d, 1);
  }
  // Data deduzida + hora que já passou hoje: vai para a próxima ocorrência.
  if (s.dateImplicit && s.date === today && s.time !== null && s.time <= nowTime && s.next) {
    s.date = s.next(today);
  }

  return {
    title: buildTitle(s),
    date: s.date,
    time: s.time,
    priority: s.priority,
    tags: s.tags,
    list: s.list,
    rrule: s.rrule,
    matches: s.matches.sort((a, b) => a.start - b.start),
  };
}
