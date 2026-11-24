# QA — Objetivo 8: app web sincronizando com a API

_24/11/2026. Critérios em `docs/project/escopo.md`. Unidade: `apps/web/src/test/fila-db.test.ts` (middleware da
fila) e `sync.test.ts` (dois aparelhos com um servidor falso que segue o ADR 0005). Ponta a ponta:
`tests/e2e/sync.spec.ts`, com a API Python e PostgreSQL de verdade e dois contextos do navegador como aparelhos._

| # | Critério | Unidade | Navegador + API |
|---|---|---|---|
| 1 | Sem login funciona como antes; menu só "Conta"; nenhuma chamada de rede | — | Passou |
| 2 | Login certo/errado, e-mail e "Sincronizado"; Sair encerra | — | Passou |
| 3 | Mudanças sobem sozinhas (sem clicar) | `fila-db` (todas as operações de escrita) | Passou |
| 4 | O que muda no A aparece no B, inclusive lixeira e checklist | `sync` | Passou |
| 5 | Campos diferentes offline viram os dois; mesmo campo vence o mais recente | `sync` | Passou (campos diferentes) |
| 6 | Offline: "Offline · N pendentes"; sobe sozinho quando a conexão volta | `sync` | Passou |
| 7 | Primeiro login envia o que existia; exemplos nunca alterados não sobem nem são criados depois | `sync` | Passou |
| 8 | Sessão vencida: aviso, fila guardada, sobe ao entrar de novo | `sync` | Passou |

Execuções: `pnpm e2e` com API 39/39 em três rodadas seguidas; sem API 34 passam e os 5 de sync são pulados.
`pnpm test` (web 47, core 131), `pnpm test:api` (34), tipos, lint e build. `pnpm dev` repassando `/api` para a API
local conferido com `curl`.

## Defeitos achados e corrigidos
- **Alta:** ao aplicar um registro do servidor, `null` virava "campo apagado"; em `hora`, `data` e `rrule` o `null`
  é um valor ("sem hora"). Agora `null` fica `null`.
- **Média:** num aparelho que entrou na conta antes de abrir Finanças, os exemplos seriam criados depois do login e
  subiriam para a conta. Agora aparelho com conta não cria exemplos.
- **Baixa:** ao abrir, o app consultava a API mesmo sem nunca ter entrado numa conta (gerava 401 no console). Agora
  só consulta se este aparelho já teve conta.

## Observações
- Com o relógio parado dos testes, duas edições no mesmo milissegundo empatam e a anterior fica (regra do ADR 0005).
  Na vida real isso não acontece; o teste avança o relógio de cada aparelho.
- A tela do outro aparelho atualiza no próximo ciclo (até 60 s, ou ao voltar para a aba). Aviso instantâneo (SSE)
  fica para depois.
