# QA — Objetivo 5: PWA (instalar e abrir sem internet)

_24/11/2026. Critérios em `docs/project/escopo.md`. Verificado no **build de produção** (`pnpm build`, servindo
`apps/web/dist/client/` com fallback para `_shell.html`), Chromium._

| # | Critério | Como | Resultado |
|---|---|---|---|
| 1 | Manifesto válido: nome, `standalone`, `start_url`, cor, ícones 192/512/maskable | Lê o manifesto e mede os ícones; `Page.getInstallabilityErrors` do Chromium sem erros | Passou |
| 2 | Sem internet, `/`, `/financas` e rota inexistente abrem o app com os dados | Rede desligada no navegador, recarregar e navegar direto | Passou |
| 3 | Aviso "Pronto para usar sem internet" na primeira visita | — | Passou |
| 4 | Versão nova: aviso com "Atualizar"; não recarrega sozinho; ao clicar, troca e recarrega | Segunda cópia do build com `sw.js` diferente, no mesmo endereço | Passou |
| 5 | Botão "Instalar" só quando o navegador oferece; some depois | Convite `beforeinstallprompt` simulado | Passou |
| 6 | Dados intactos depois de atualizar | Tarefa criada antes continua lá | Passou |

Extras: menu com "Instalar" cabe em 375 px; roteiros dos objetivos 2 (24/24), 3 (16/16) e 4 (24/24) rodados de
novo com servidor recém-iniciado. Comandos: `pnpm test`, `pnpm typecheck`, `pnpm lint` (0 erros), `pnpm build`.

## Observações
- Sem internet, as fontes do Google não carregam na primeira vez (o app usa a fonte do sistema); a partir da
  visita seguinte com internet elas ficam em cache.
- A instalação real (janela própria, ícone na tela inicial) depende do navegador e não dá para automatizar no
  modo headless; o Chromium confirma que o app é instalável.
- Achado no processo de QA: servidores `vite dev` de rodadas anteriores ficavam vivos (o `pkill` não casava com
  o nome do processo). Os roteiros agora sobem com `--strictPort` e encerram com `pkill -f "vite.js dev"`.
