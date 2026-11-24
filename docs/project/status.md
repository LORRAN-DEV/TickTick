# Status do projeto

_Atualizado em 24/11/2026._

## Pronto
- **Parser de quick-add** em português: datas, horas, recorrência, `#tag`, `~lista`, `!prioridade`
  (`packages/core/src/parser/`, 53 testes).
- **Cálculos financeiros**: resumo do mês, despesas por categoria, saldo por conta, transferências,
  vencimentos, metas, leitura/escrita de CSV e valores em reais (`packages/core/src/finance/`, 14 testes).
- **Tela de controle financeiro** (`apps/web`): painel com gráficos, movimentações, resumo mensal, metas e
  "como usar". Build, lint e testes passando.
- **Time de agentes** configurado (`CLAUDE.md`, `.claude/agents/`, `.claude/skills/`).

## Falta
- Tela de **tarefas** (o parser existe, a interface não).
- **Guardar os dados**: hoje tudo some ao recarregar a página.
- Contas e categorias editáveis (a tela usa listas fixas), transferências na interface, importar/exportar CSV.
- PWA (funcionar offline e instalar no celular).
- Back-end e sincronização entre aparelhos.
- Testes de ponta a ponta no navegador.

## Decisões pendentes do humano
1. **Stack do back-end**: Node (Hono) ou Python? Ver `docs/adr/0002-stack-do-back-end.md`.
2. **Qual é o primeiro objetivo** para o time (sugestões abaixo).
3. O documento de planejamento "Estrutura de um app pessoal inspirado no TickTick" citado no README não está no
   repositório. Se puder, adicione em `docs/project/` para o `project-manager` tirar escopo e critérios dele.

## Próximos objetivos sugeridos (em ordem)
1. Persistência local no navegador (IndexedDB) para finanças, sem depender de back-end.
2. Tela de tarefas com quick-add usando o parser.
3. Navegação única entre Tarefas e Finanças.
4. PWA offline.
5. API e sincronização (depois do ADR 0002).
