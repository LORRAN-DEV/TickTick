# ADR 0004 — PWA: service worker gerado pelo Workbox depois do build

- **Status:** aceito
- **Data:** 2026-11-24
- **Autor:** architect
- **Revisado por:** tech-lead, qa

## Contexto
O objetivo 5 pede que o app abra sem internet e possa ser instalado. O caminho comum seria o
`vite-plugin-pwa` (que o plano cita), mas, testado na versão 2.0.0, ele não gera o service worker neste projeto:
o TanStack Start constrói em dois ambientes do Vite 8 (cliente e SSR) e o plugin decide pela configuração
global, que aparece como SSR, então pula a geração. Além disso, a casca `_shell.html` só existe depois do
prerender, que roda depois do bundle.

## Decisão
- **Manifesto** estático em `apps/web/public/manifest.webmanifest`, com ícones em `public/icons/` (192, 512,
  `maskable` 512 e 180 para iPhone), referenciado no `<head>` em `__root.tsx`.
- **Service worker** gerado por `apps/web/scripts/gerar-sw.mjs` com `workbox-build` (`generateSW`), rodado no
  fim do `pnpm build`, quando `dist/client/` já está completo. Pré-cacheia HTML, JS, CSS, ícones e manifesto;
  qualquer navegação sem rede cai em `/_shell.html` (as rotas são do cliente). Fontes do Google ficam em cache
  em tempo de uso (`StaleWhileRevalidate`).
- **Registro e atualização** com `workbox-window` em `src/components/AvisosPWA.tsx`, só no build de produção:
  aviso "Pronto para usar sem internet" na primeira instalação; versão nova fica esperando até o usuário clicar
  em "Atualizar" (`skipWaiting` sob demanda), para não perder o que está sendo digitado.
- **Instalar:** botão no menu quando o navegador dispara `beforeinstallprompt` (Chrome, Edge, Android). No iPhone
  a instalação é pelo "Adicionar à Tela de Início" do Safari.

## Alternativas consideradas
| Opção | Prós | Contras |
|---|---|---|
| `vite-plugin-pwa` | Padrão do ecossistema, citado no plano | Não gera o SW com os ambientes do Vite 8 + TanStack Start; casca fica fora do cache |
| **Workbox depois do build (escolhida)** | Mesmo motor do plugin; vê o build final, inclusive `_shell.html`; sem mágica | Script próprio para manter (≈40 linhas) |
| Service worker escrito à mão | Controle total | Reinventar cache, versões e limpeza que o Workbox já resolve |

## Consequências
- Em produção, o servidor (Caddy) deve servir `sw.js` e `manifest.webmanifest` com `Cache-Control: no-cache`,
  senão o navegador demora a ver versões novas; e qualquer rota sem arquivo deve cair em `_shell.html`.
- No `pnpm dev` não há service worker (de propósito: evita cache atrapalhando o desenvolvimento). Para testar o
  PWA, use `pnpm build` e sirva `apps/web/dist/client/`.
- Notificações push (lembretes) virão depois, junto com a API; o mesmo service worker será estendido.
