/** Entrada e saída de valores no formato brasileiro (moeda, datas e CSV com ";"). */
import type { PlainDate } from "../parser/dates.ts";

export const brl = (n: number): string => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (d: PlainDate): string => d.split("-").reverse().join("/");

/** Aceita "1.234,56", "1234.56" e "R$ 50". Devolve NaN se não for número. */
export function parseValor(s: string): number {
  const t = s.replace(/[R$\s]/g, "");
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Converte "dd/mm/aaaa" ou "aaaa-mm-dd" para PlainDate; "" se inválido. */
export function parseData(s: string): PlainDate | "" {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : "";
}

export function toCSV(rows: Array<Array<string | number>>): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c);
          return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(";"),
    )
    .join("\n");
}

/** Lê CSV separado por ";" ou "," (detectado na 1ª linha), com aspas e quebras de linha. */
export function parseCSV(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let aspas = false;
  const sep = (text.split("\n")[0] ?? "").includes(";") ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (aspas) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else cur += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur.replace(/\r$/, ""));
      out.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur.replace(/\r$/, ""));
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim()));
}
