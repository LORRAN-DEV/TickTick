/**
 * UUID v7 (RFC 9562): os 48 primeiros bits são o instante em milissegundos, o resto é aleatório.
 * Gerado no próprio aparelho, permite criar registros offline; por começar pelo tempo,
 * ids mais novos ordenam depois dos mais antigos.
 *
 * Monotônico (método 1 da RFC): no mesmo milissegundo, os 12 bits seguintes ao tempo viram um
 * contador, então ids gerados em sequência rápida continuam em ordem crescente.
 */
let ultimoMs = -1;
let contador = 0;

export function uuidv7(agora: number = Date.now()): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let ms = agora;
  if (ms <= ultimoMs) {
    ms = ultimoMs;
    contador++;
    if (contador > 0xfff) {
      ms++; // contador esgotado: avança 1 ms
      contador = 0;
    }
  } else {
    contador = (b[6]! & 0x07) * 256 + b[7]!; // começa baixo (até 0x7ff) para sobrar espaço
  }
  ultimoMs = ms;
  let t = ms;
  for (let i = 5; i >= 0; i--) {
    b[i] = t % 256;
    t = Math.floor(t / 256);
  }
  b[6] = 0x70 | (contador >> 8); // versão 7 + 4 bits altos do contador
  b[7] = contador & 0xff;
  b[8] = (b[8]! & 0x3f) | 0x80; // variante RFC
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
