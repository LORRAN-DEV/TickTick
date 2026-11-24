# Status do projeto

_Atualizado em 24/11/2026, depois do objetivo 2._

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
- **Time de agentes** configurado (`CLAUDE.md`, `.claude/agents/`, `.claude/skills/`).

## Falta
- Editar uma tarefa depois de criada, notas, subtarefas, checklist e pastas.
- Lembretes e notificações.
- Contas e categorias editáveis (a tela usa listas fixas), transferências na interface, importar/exportar CSV.
- PWA (funcionar offline e instalar no celular).
- Back-end e sincronização entre aparelhos.
- Testes de ponta a ponta no navegador.

## Decisões tomadas
- Back-end em **Python** (FastAPI + PostgreSQL): `docs/adr/0002-stack-do-back-end.md`.
- Plano do app versionado em `docs/project/plano.md`.
- App web como **SPA estático** (modo SPA do TanStack Start, sem servidor): `docs/adr/0003-app-web-como-spa.md`.

## Decisões pendentes do humano
1. Itens em aberto do plano: onde hospedar (VPS ou máquina em casa), iPhone ou Android, importar de outro app.

## Próximos objetivos sugeridos (em ordem)
1. Detalhe da tarefa: editar título, data, hora, prioridade, tags, lista e repetição; notas em Markdown.
2. Subtarefas e checklist.
3. PWA offline (service worker guardando o build estático) e instalar no celular.
4. Suíte e2e versionada em `tests/` (Playwright) com os roteiros dos objetivos 1 e 2.
5. `apps/api` em Python, sincronização e lembretes (Web Push).
