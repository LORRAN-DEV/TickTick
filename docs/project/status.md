# Status do projeto

_Atualizado em 24/11/2026, depois do objetivo 9._

## Pronto
- **Parser de quick-add** em português: datas, horas, recorrência, `#tag`, `~lista`, `!prioridade`
  (`packages/core/src/parser/`, 53 testes).
- **Cálculos financeiros**: resumo do mês, despesas por categoria, saldo por conta, transferências,
  vencimentos, metas, leitura/escrita de CSV e valores em reais (`packages/core/src/finance/`, 14 testes).
- **Tela de controle financeiro** (`apps/web`): painel com gráficos, movimentações, resumo mensal, metas e
  "como usar".
- **Objetivo 1: finanças guardadas no navegador** (IndexedDB via Dexie). Os dados não somem mais ao recarregar
  e funcionam sem internet. Todos os critérios verificados (`docs/qa/objetivo-1.md`).
- **Objetivo 2: tela de tarefas** (página inicial): quick-add com prévia do que foi reconhecido, Inbox e listas
  criadas pelo `~lista`, listas inteligentes (Hoje, Amanhã, Próximos 7 dias, Tudo, Concluídas, Lixeira),
  concluir, reabrir, "não vou fazer", lixeira e restaurar. Tarefas recorrentes avançam para a próxima data ao
  concluir (`packages/core/src/recurrence/`). Menu entre Tarefas e Finanças. Verificado em `docs/qa/objetivo-2.md`.
- **Objetivo 3: detalhe da tarefa**: clicar no título abre um painel para editar título, data, hora, prioridade,
  tags, lista, repetição e notas; salva sozinho. Verificado em `docs/qa/objetivo-3.md`.
- **Objetivo 4: subtarefas e checklist**: subtarefas pelo painel (até 5 níveis, com quick-add), progresso na
  lista, concluir/lixeira/mudar de lista em cascata; checklist com marcar, renomear e remover. Verificado em
  `docs/qa/objetivo-4.md`.
- **Objetivo 5: PWA**: o app abre sem internet (inclusive `/financas` e recarregando), pode ser instalado (botão
  "Instalar" no menu quando o navegador oferece) e avisa quando há versão nova, trocando só quando você clica em
  "Atualizar". Verificado em `docs/qa/objetivo-5.md`.
- **Objetivo 6: testes de ponta a ponta e CI**: 33 testes em `tests/e2e/` cobrindo os critérios dos objetivos 1 a 5
  (`pnpm e2e`), e o GitHub Actions rodando testes, tipos, lint, build e e2e a cada push. `docs/qa/objetivo-6.md`.
- **Objetivo 7: API em Python** (`apps/api`, FastAPI + PostgreSQL): usuário criado por comando, login com
  cookie de sessão e limite de tentativas, `POST /api/sync/push` e `GET /api/sync/pull` com conflito resolvido
  por campo (vence a edição mais recente). 32 testes com pytest. `docs/qa/objetivo-7.md`.
- **Objetivo 8: app sincronizando**: página Conta (entrar/sair), fila de saída automática no banco local, sync ao
  abrir, ao voltar a conexão, logo depois de cada mudança e a cada minuto; indicador no menu ("Sincronizado",
  "Offline · N pendentes", "Entre de novo"). Verificado com dois aparelhos e a API de verdade. `docs/qa/objetivo-8.md`.
- **Objetivo 9: implantação**: `infra/` com Docker Compose (Postgres, API, Caddy com HTTPS servindo o app e
  repassando `/api`, backup diário de 14 dias), guia `infra/README.md` e `infra/verificar.sh`. `docs/qa/objetivo-9.md`.
- **Time de agentes** configurado (`CLAUDE.md`, `.claude/agents/`, `.claude/skills/`).

## Falta
- Pastas, notas em Markdown (hoje são texto puro) e arrastar para reordenar.
- Lembretes e notificações.
- Contas e categorias editáveis (a tela usa listas fixas), transferências na interface, importar/exportar CSV.
- Aviso instantâneo entre aparelhos (SSE): hoje o outro aparelho vê a mudança em até 60 s.

## Decisões tomadas
- Back-end em **Python** (FastAPI + PostgreSQL): `docs/adr/0002-stack-do-back-end.md`.
- Plano do app versionado em `docs/project/plano.md`.
- App web como **SPA estático** (modo SPA do TanStack Start, sem servidor): `docs/adr/0003-app-web-como-spa.md`.
- **PWA** com service worker do Workbox gerado depois do build: `docs/adr/0004-pwa-com-workbox-depois-do-build.md`.
- **Servidor de sync** com documentos JSONB e relógio por campo: `docs/adr/0005-servidor-de-sync.md`.
- **Cliente de sync** com fila de saída por middleware do Dexie: `docs/adr/0006-cliente-de-sync.md`.

## Decisões pendentes do humano
1. Itens em aberto do plano: onde hospedar (VPS ou máquina em casa), iPhone ou Android, importar de outro app.

## Próximos objetivos sugeridos (em ordem)
1. **Você** escolher onde hospedar e subir (guia em `infra/README.md`); depois, usar por duas semanas, como o plano
   pede antes da fase 2.
2. Lembretes: worker no servidor e Web Push.
3. Aviso instantâneo entre aparelhos (SSE).
