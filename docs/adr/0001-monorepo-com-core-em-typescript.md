# ADR 0001 — Monorepo pnpm com a lógica de negócio em `@ticktick/core`

- **Status:** aceito
- **Data:** 2026-11-24
- **Autor:** tech-lead (registro do que já foi feito)
- **Revisado por:** humano

## Contexto
O projeto juntou duas bases: o parser de quick-add em português (monorepo `meu-tick`) e um protótipo de
controle financeiro feito no Lovable (React + TanStack Start). As duas tinham regra de negócio misturada ou
separada de jeitos diferentes.

## Decisão
- Um monorepo pnpm: `packages/*` para bibliotecas, `apps/*` para aplicações.
- Toda regra de negócio (parser, cálculos financeiros, datas) fica em `packages/core`, TypeScript puro e
  sem dependências, testada com `node:test`. Roda igual no navegador e no servidor.
- `apps/web` é a interface (React + TanStack Start + Tailwind + shadcn/ui) e importa `@ticktick/core`.
- Datas de calendário são strings `YYYY-MM-DD` no fuso local (`PlainDate`), nunca derivadas de UTC.

## Alternativas consideradas
| Opção | Prós | Contras |
|---|---|---|
| Lógica dentro de cada app | Menos pastas | Duplicação quando existir API; difícil testar sem UI |
| Core compartilhado (escolhida) | Uma regra, um teste; a UI responde na hora sem ir ao servidor | Se o back-end for em outra linguagem, a regra precisa existir nas duas (ver ADR 0002) |

## Consequências
- O `frontend` não escreve cálculo novo em componente: pede ao `backend` para pôr no core.
- O app web ainda guarda dados só em memória; persistência é a próxima decisão relevante.

## Objeções registradas
Nenhuma.
