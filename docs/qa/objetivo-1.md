# QA — Objetivo 1: finanças guardadas no navegador

_24/11/2026. Critérios em `docs/project/escopo.md`._

| # | Critério | Como foi verificado | Resultado |
|---|---|---|---|
| 1 | Movimentação continua depois de recarregar | Teste de unidade (`apps/web/src/test/financas-db.test.ts`) e navegador (Chromium) | Passou |
| 2 | Status pago/não pago se mantém | Unidade e navegador | Passou |
| 3 | Apagada não volta; exclusão lógica | Unidade (confere `excluidoEm` no banco) e navegador | Passou |
| 4 | Meta criada e aporte se mantêm | Unidade e navegador | Passou |
| 5 | Exemplos só na 1ª abertura; "Começar do zero" não volta | Unidade (inclusive duas aberturas simultâneas) e navegador | Passou |
| 6 | Grava sem internet | Navegador com a rede desligada | Passou |
| 7 | Id UUID v7 e datas de criação/alteração | Unidade (`packages/core/src/ids.test.ts` e banco) | Passou |

Comandos: `pnpm test`, `pnpm typecheck`, `pnpm lint` (0 erros, 6 avisos antigos do shadcn).

## Defeitos achados e corrigidos
- **Média:** a ordem das metas de exemplo variava a cada primeira abertura (ids gerados no mesmo milissegundo).
  Corrigido dando um instante por registro.
- **Baixa:** valores como `1.234,56` viravam inválidos no formulário; agora usam `parseValor` do core.

## Pendências
- A verificação no navegador foi um roteiro avulso. Falta a suíte e2e versionada em `tests/` (Playwright),
  com servidor de desenvolvimento subindo sozinho.
