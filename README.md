# TickTick

App pessoal de tarefas inspirado no TickTick, com controle financeiro: PWA offline-first com back-end self-hosted.
O plano completo (escopo, arquitetura, modelo de dados, roadmap) está em `docs/project/plano.md`.

## Estado atual

| Pacote | O que tem | Status |
| --- | --- | --- |
| `packages/core` | Parser de quick-add em português (datas, horas, recorrência, `#tag`, `~lista`, `!prioridade`) recorrência (próxima ocorrência de RRULE), tarefas e listas inteligentes, e cálculos do controle financeiro (resumo do mês, categorias, saldo por conta, vencimentos, metas, CSV) | Pronto, 105 testes |
| `apps/web` | App web (React + TanStack Start em modo SPA + Tailwind/shadcn), build estático. Tarefas (quick-add, Inbox, listas, listas inteligentes, recorrência) e controle financeiro (painel, movimentações, resumo mensal, metas) | Em andamento: dados guardados no navegador (IndexedDB), sem sync |
| `apps/api` | API (Python: FastAPI + PostgreSQL) | A fazer |

## Rodando

Requisitos: Node 22.18 ou mais novo (roda TypeScript direto, sem build) e pnpm.

```bash
corepack enable        # ativa o pnpm que vem com o Node
pnpm install
pnpm test              # roda os testes de todos os pacotes
pnpm typecheck         # checagem de tipos com o tsc
pnpm dev               # sobe o app web (o endereço aparece no terminal)
pnpm build             # build estático do app web em apps/web/dist/client
```

## Quick-add: o que o parser entende

```text
pagar boleto amanhã 15h !alta #casa      -> amanhã, 15:00, prioridade alta, tag casa
academia toda segunda, quarta e sexta 7h -> repete seg/qua/sex às 07:00
pagar aluguel todo dia 5                 -> repete todo mês no dia 5
reunião na quinta às 3 da tarde ~trabalho -> quinta, 15:00, lista trabalho
revisar daqui a 3 dias                   -> hoje + 3 dias
```

Regras de decisão, para discutir e ajustar:

- Dia da semana sozinho inclui hoje ("academia terça" numa terça = hoje).
- "próxima terça" e "terça que vem" nunca são hoje: é a próxima depois de hoje.
- Só a hora, sem data: hoje, ou amanhã se o horário já passou.
- "estudar 2h" é duração, não horário: sem "às", horas abaixo de 6 só valem com minutos ou período.
- "de manhã", "à tarde" e "à noite" viram 09:00, 15:00 e 20:00 (configurável).

## Controle financeiro: regras

- Só movimentações **pagas** entram nos totais e saldos; pendentes aparecem à parte e canceladas são ignoradas.
- Saldo do mês = entradas − despesas − investimentos.
- Transferência não é entrada nem despesa: só move dinheiro entre contas.
- Meta só fica "Concluída" quando o acumulado chega ao alvo; passou do prazo sem chegar, fica "Atrasada".
- Valores e datas aceitam o formato brasileiro (`R$ 1.234,56`, `05/03/2026`); CSV usa `;`.

## Time de agentes (Claude Code)

O projeto vem com um time de agentes (Tech Lead, Architect, Backend, Frontend, QA e Gerente de Projeto).
Protocolo em `CLAUDE.md`, papéis em `.claude/agents/`, estado e decisões em `docs/project/` e `docs/adr/`.

```bash
claude --agent tech-lead
```

Depois, dentro do Claude Code: `/kickoff <objetivo>`. Detalhes e monitor de tokens: `tools/time-agentes/README.md`.

## Licença

MIT, ver [LICENSE](LICENSE).
