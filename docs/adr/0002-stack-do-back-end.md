# ADR 0002 — Back-end em Python (FastAPI + PostgreSQL)

- **Status:** aceito
- **Data:** 2026-11-24
- **Autor:** architect
- **Revisado por:** humano (decisão dele)

## Contexto
O plano (`docs/project/plano.md`) previa TypeScript de ponta a ponta: Hono + Zod, Drizzle e pg-boss, para que
datas, recorrência e validação fossem o mesmo código no navegador e no servidor. O humano decidiu usar Python
no back-end. O app continua offline-first: o navegador grava primeiro no banco local e sincroniza depois, então a
regra que roda no aparelho continua em TypeScript (`@ticktick/core`, ADR 0001).

## Decisão
`apps/api` em Python 3.12+, com estas trocas em relação ao plano:

| No plano (Node) | Em Python |
|---|---|
| Hono + Zod | FastAPI + Pydantic |
| Drizzle ORM e migrações | SQLAlchemy 2 + Alembic |
| pg-boss (fila e agendamento no Postgres) | Fila no próprio Postgres (ex.: Procrastinate) ou APScheduler; sem Redis, como no plano |
| rrule.js | `dateutil.rrule` (mesmo padrão RFC 5545) |
| web-push (Node) | `pywebpush` (chaves VAPID) |
| Vitest no servidor | pytest |

PostgreSQL, Caddy, Docker Compose, SSE e o formato do sync (`/sync/pull`, `/sync/push`) continuam como no plano.

## Contrato entre os dois lados
Para não depender de tipos compartilhados entre linguagens:
- A API publica **OpenAPI** (o FastAPI gera sozinho); o cliente gera seus tipos TypeScript a partir dele.
- O **aparelho interpreta** o quick-add (o parser já está em TS) e envia a tarefa estruturada. A rota
  `POST /api/quick-add` do plano, usada só por integrações, fica para depois e exigirá portar o parser.
- O servidor calcula o próximo lembrete com `dateutil.rrule` a partir do texto RRULE da tarefa.

## Alternativas consideradas
| Opção | Prós | Contras |
|---|---|---|
| Hono (Node), como no plano | Mesma regra nas duas pontas | Não é a escolha do humano |
| **FastAPI (escolhida)** | Python para integrações, scripts, IA e importadores | Regras usadas nas duas pontas ficam duplicadas |
| Tudo em Python (servidor renderiza as páginas) | Uma linguagem só | Perde o offline-first e o PWA |

## Consequências
- Recorrência (próxima ocorrência) existirá em TS (cliente) e Python (servidor). O `qa` mantém um arquivo de
  casos de teste em comum (`docs/qa/casos-recorrencia.json`, quando existir) rodado pelos dois lados.
- O `backend` passa a ser dono de `apps/api/` em Python e continua dono de `packages/core/`.
- `pnpm test` não cobre a API; ela terá seu próprio comando (`pytest`), a documentar quando existir.

## Objeções registradas
O architect registrou que o plano original preferia Node pelo reuso de código. O humano decidiu por Python.
