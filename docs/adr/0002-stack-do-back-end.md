# ADR 0002 — Stack do back-end (`apps/api`)

- **Status:** proposto, **aguardando decisão do humano**
- **Data:** 2026-11-24
- **Autor:** architect
- **Revisado por:** —

## Contexto
O plano original previa `apps/api` em Hono + PostgreSQL. O humano comentou que talvez a stack mude para Python.
Hoje toda a regra de negócio está em TypeScript (`@ticktick/core`, ADR 0001) e o app web depende dela para
responder na hora (pré-visualização do quick-add, totais do mês) e para funcionar offline.

## Opções
| Opção | Prós | Contras |
|---|---|---|
| A. Hono (Node) + PostgreSQL | Reusa `@ticktick/core` no servidor sem duplicar; uma linguagem só; mesmos tipos ponta a ponta | Ecossistema de dados/automação menor que o do Python |
| B. FastAPI (Python) + PostgreSQL, core continua em TS no cliente | Python para integrações, relatórios, importação de extratos, scripts | Regras que o servidor também precise validar ficam duplicadas em duas linguagens; testes de paridade |
| C. Tudo em Python (servidor renderiza as páginas, ex. HTMX) | Uma linguagem só | Perde o offline-first/PWA; reescreve a interface e o parser |

## Recomendação do architect
A, ou B se houver um motivo concreto para Python (ex.: importar extratos bancários, análises). Evitar C, que
contraria o objetivo offline-first.

## Decisão
Pendente. O `project-manager` deve levar a pergunta ao humano antes de qualquer tarefa em `apps/api`.
