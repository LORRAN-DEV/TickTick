# QA — Objetivo 6: suíte de ponta a ponta e CI

_24/11/2026. Critérios em `docs/project/escopo.md`._

| # | Critério | Resultado |
|---|---|---|
| 1 | `pnpm e2e` faz o build, sobe o servidor estático, roda e encerra sem deixar processos | Passou (0 processos depois) |
| 2 | Critérios dos objetivos 1 a 5 cobertos, com o número no nome do teste | Passou: 33 testes em `tests/e2e/` |
| 3 | Relógio fixado (terça 24/11/2026 10:00, São Paulo) | Passou: `abrir()` em `tests/e2e/ajuda.ts` |
| 4 | 3 rodadas seguidas sem falha | Passou: 33/33 nas três (≈55 s cada) |
| 5 | GitHub Actions com testes, tipos, lint, build e e2e | `.github/workflows/ci.yml`; resultado da primeira execução no GitHub |

## Como rodar
```bash
pnpm e2e                                    # tudo
pnpm --filter @ticktick/e2e e2e -g "objetivo 4"   # só um grupo
```
Numa máquina nova, uma vez: `pnpm --filter @ticktick/e2e exec playwright install chromium`.
Falhou? Captura de tela e contexto ficam em `tests/test-results/`.

## Achados ao montar a suíte
- **Baixa (corrigido):** com o service worker bloqueado (alguns navegadores, modo privado), o app registrava um
  `console.error`. Agora é um aviso (`console.warn`); o app funciona, só não abre offline.
- Com o painel de detalhe aberto, o resto da página fica `aria-hidden` (comportamento do Radix, correto para leitor
  de tela). Os testes localizam linhas pelo texto do título por causa disso.
- Testes que recarregam a página esperam a confirmação na tela antes (o banco grava em poucos milissegundos, mas
  recarregar no mesmo instante do clique pode perder a gravação). Para uma pessoa isso não acontece na prática.
