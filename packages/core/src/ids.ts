/**
 * UUID v7 (RFC 9562): os 48 primeiros bits são o instante em milissegundos, o resto é aleatório.
 * Gerado no próprio aparelho, permite criar registros offline; por começar pelo tempo,
 * ids mais novos ordenam depois dos mais antigos.
 */
export function uuidv7(agora: number = Date.now()): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let t = agora;
  for (let i = 5; i >= 0; i--) {
    b[i] = t % 256;
    t = Math.floor(t / 256);
  }
  b[6] = (b[6]! & 0x0f) | 0x70; // versão 7
  b[8] = (b[8]! & 0x3f) | 0x80; // variante RFC
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
