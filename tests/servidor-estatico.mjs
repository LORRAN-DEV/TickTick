// Servidor estático para os testes e2e: serve o build do app web como o Caddy fará em produção
// (qualquer rota sem arquivo cai em _shell.html; sw.js e manifesto sem cache).
//
// A pasta servida é apps/web/dist/client, ou a escrita em tests/.tmp/raiz.txt — o teste de
// atualização do PWA usa isso para trocar de versão sem reiniciar o servidor.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = fileURLToPath(new URL(".", import.meta.url));
const padrao = resolve(aqui, "../apps/web/dist/client");
const arquivoRaiz = resolve(aqui, ".tmp/raiz.txt");
const porta = Number(process.env.PORTA ?? 4173);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

const raiz = () => (existsSync(arquivoRaiz) ? readFileSync(arquivoRaiz, "utf8").trim() : padrao);

createServer((req, res) => {
  const base = raiz();
  let caminho = join(base, decodeURIComponent((req.url ?? "/").split("?")[0]));
  if (!caminho.startsWith(base) || !existsSync(caminho) || statSync(caminho).isDirectory()) {
    caminho = join(base, "_shell.html");
  }
  const semCache = /(sw\.js|\.webmanifest|\.html)$/.test(caminho);
  res.writeHead(200, {
    "content-type": TIPOS[extname(caminho)] ?? "application/octet-stream",
    "cache-control": semCache ? "no-cache" : "public, max-age=31536000, immutable",
  });
  createReadStream(caminho).pipe(res);
}).listen(porta, "127.0.0.1", () => console.log(`servindo ${raiz()} em http://127.0.0.1:${porta}`));
