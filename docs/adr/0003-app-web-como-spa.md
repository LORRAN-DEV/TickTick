# ADR 0003 — App web como SPA estático (modo SPA do TanStack Start)

- **Status:** aceito
- **Data:** 2026-11-24
- **Autor:** architect
- **Revisado por:** humano

## Contexto
O plano pede um PWA offline-first em React + Vite, com dados no IndexedDB (Dexie). O app web veio do Lovable
em TanStack Start, que renderiza as páginas no servidor e gera um Worker da Cloudflare (via nitro). Com os dados
no navegador, o servidor não tem nada para renderizar, e o PWA precisa de arquivos estáticos que o service worker
possa guardar em cache.

## Decisão
- Ligar o modo SPA do TanStack Start (`spa: { enabled: true }` em `apps/web/vite.config.ts`). O build pré-renderiza
  só uma casca HTML (`_shell.html`); rotas e dados carregam no navegador.
- Desligar o nitro (`nitro: false`): o build é só `apps/web/dist/client/`, arquivos estáticos servidos pelo Caddy
  com fallback de qualquer rota para `_shell.html`.
- Em `__root.tsx`, o `<Outlet />` fica dentro de `<ClientOnly>`. Sem isso o React acusava erro de hidratação
  (#418): a casca tem um `<Suspense>` vazio no lugar da rota, e o cliente montava a página direto.
- Rotas por arquivo, componentes shadcn e Tailwind continuam iguais.

## Alternativas consideradas
| Opção | Prós | Contras |
|---|---|---|
| Manter SSR do TanStack Start | Nada muda agora | Servidor sem função; Worker da Cloudflare fora do plano (Docker + Caddy); atrapalha o PWA |
| **Modo SPA do TanStack Start (escolhida)** | Mudança pequena; mantém rotas e componentes | Ainda depende do plugin do Lovable para o Vite |
| Migrar para Vite puro + TanStack Router | Exatamente o plano; menos camadas | Reescrever configuração, entrada e roteamento |

## Consequências
- `pnpm build` gera `apps/web/dist/client/`. Para servir: qualquer servidor estático com fallback para `_shell.html`.
- `src/server.ts`, `src/start.ts` e `src/lib/error-*.ts` só atuam no `pnpm dev`; podem sair numa limpeza futura,
  junto com o plugin `@lovable.dev/vite-tanstack-config`, se migrarmos para Vite puro.
- Próximo passo do PWA: service worker (vite-plugin-pwa) guardando `dist/client/` em cache.
