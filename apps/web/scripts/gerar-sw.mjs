// Gera o service worker do PWA (dist/client/sw.js) depois do `vite build`.
//
// Roda depois do prerender, então a casca `_shell.html` já existe e entra no cache como o
// resto do app. Qualquer rota (/, /financas...) sem internet abre essa casca (ADR 0004).
import { generateSW } from "workbox-build";
import { fileURLToPath } from "node:url";

const pasta = fileURLToPath(new URL("../dist/client/", import.meta.url));

const { count, size, warnings } = await generateSW({
  globDirectory: pasta,
  globPatterns: ["**/*.{html,js,css,ico,png,svg,woff2,webmanifest}"],
  swDest: `${pasta}sw.js`,
  navigateFallback: "/_shell.html",
  // Arquivos com hash no nome não precisam de revisão: o nome já muda a cada versão.
  dontCacheBustURLsMatching: /^assets\//,
  cleanupOutdatedCaches: true,
  // A nova versão espera o usuário clicar em "Atualizar" (ver src/components/AvisosPWA.tsx).
  skipWaiting: false,
  clientsClaim: true,
  sourcemap: false,
  runtimeCaching: [
    {
      urlPattern: ({ url }) =>
        url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "fontes",
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
  ],
});

for (const w of warnings) console.warn(`[sw] aviso: ${w}`);
console.log(`[sw] dist/client/sw.js: ${count} arquivos no cache (${(size / 1024).toFixed(0)} KB)`);
