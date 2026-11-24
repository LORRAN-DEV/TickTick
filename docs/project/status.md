# Status do projeto

_Atualizado em 24/11/2026, depois do objetivo 1._

## Pronto
- **Parser de quick-add** em português: datas, horas, recorrência, `#tag`, `~lista`, `!prioridade`
  (`packages/core/src/parser/`, 53 testes).
- **Cálculos financeiros**: resumo do mês, despesas por categoria, saldo por conta, transferências,
  vencimentos, metas, leitura/escrita de CSV e valores em reais (`packages/core/src/finance/`, 14 testes).
- **Tela de controle financeiro** (`apps/web`): painel com gráficos, movimentações, resumo mensal, metas e
  "como usar".
- **Objetivo 1: finanças guardadas no navegador** (IndexedDB via Dexie). Os dados não somem mais ao recarregar
  e funcionam sem internet. Todos os critérios verificados (`docs/qa/objetivo-1.md`).
- **Time de agentes** configurado (`CLAUDE.md`, `.claude/agents/`, `.claude/skills/`).

## Falta
- Tela de **tarefas** (o parser existe, a interface não).
- Contas e categorias editáveis (a tela usa listas fixas), transferências na interface, importar/exportar CSV.
- PWA (funcionar offline e instalar no celular).
- Back-end e sincronização entre aparelhos.
- Testes de ponta a ponta no navegador.

## Decisões tomadas
- Back-end em **Python** (FastAPI + PostgreSQL): `docs/adr/0002-stack-do-back-end.md`.
- Plano do app versionado em `docs/project/plano.md`.

## Decisões pendentes do humano
1. **App web como SPA?** O plano pede PWA em React + Vite; o app veio do Lovable em TanStack Start, que renderiza
   no servidor e mira Cloudflare. Para offline e PWA, o mais simples é ligar o modo SPA do TanStack Start
   (mantém rotas e componentes). Precisa de ADR antes do PWA.
2. Itens em aberto do plano: onde hospedar (VPS ou máquina em casa), iPhone ou Android, importar de outro app.

## Próximos objetivos sugeridos (em ordem)
1. Tela de tarefas com quick-add (Inbox e listas), guardada no Dexie como as finanças.
2. Recorrência em `packages/core` (próxima ocorrência a partir do RRULE), antes dos lembretes.
3. Navegação única entre Tarefas e Finanças.
4. PWA offline (depois da decisão do item 1 acima).
5. `apps/api` em Python e sincronização.
