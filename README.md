# meu-tick

App pessoal de tarefas inspirado no TickTick: PWA offline-first com back-end self-hosted.
O plano completo (escopo, arquitetura, modelo de dados, roadmap) está no documento
"Estrutura de um app pessoal inspirado no TickTick".

## Estado atual

| Pacote | O que tem | Status |
| --- | --- | --- |
| `packages/core` | Parser de quick-add em português (datas, horas, recorrência, `#tag`, `~lista`, `!prioridade`) | Pronto, 53 testes |
| `apps/web` | PWA (React + Vite) | A fazer |
| `apps/api` | API (Hono + PostgreSQL) | A fazer |

## Rodando

Requisitos: Node 22.18 ou mais novo (roda TypeScript direto, sem build) e pnpm.

```bash
corepack enable        # ativa o pnpm que vem com o Node
pnpm install
pnpm test              # roda os testes de todos os pacotes
pnpm typecheck         # checagem de tipos com o tsc
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
