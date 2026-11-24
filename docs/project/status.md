# Status do projeto

_Atualizado em 24/11/2026, depois do objetivo 7._

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
- **Time de agentes** configurado (`CLAUDE.md`, `.claude/agents/`, `.claude/skills/`).

## Falta
- Pastas, notas em Markdown (hoje são texto puro) e arrastar para reordenar.
- Lembretes e notificações.
- Contas e categorias editáveis (a tela usa listas fixas), transferências na interface, importar/exportar CSV.
- O app web ainda não usa a API: falta a tela de login e o sync (fila de saída no Dexie).
- Implantação: `docker compose` com API, Postgres e Caddy (não verificável neste ambiente, sem Docker).

## Decisões tomadas
- Back-end em **Python** (FastAPI + PostgreSQL): `docs/adr/0002-stack-do-back-end.md`.
- Plano do app versionado em `docs/project/plano.md`.
- App web como **SPA estático** (modo SPA do TanStack Start, sem servidor): `docs/adr/0003-app-web-como-spa.md`.
- **PWA** com service worker do Workbox gerado depois do build: `docs/adr/0004-pwa-com-workbox-depois-do-build.md`.
- **Servidor de sync** com documentos JSONB e relógio por campo: `docs/adr/0005-servidor-de-sync.md`.

## Decisões pendentes do humano
1. Itens em aberto do plano: onde hospedar (VPS ou máquina em casa), iPhone ou Android, importar de outro app.

## Próximos objetivos sugeridos (em ordem)
1. Sincronização no app web: tela de login, fila de saída no Dexie com o horário de cada campo alterado,
   push e pull automáticos quando há rede.
2. `docker compose` (API + Postgres + Caddy servindo o app e repassando `/api`) e backup diário.
3. Lembretes: worker no servidor e Web Push.
