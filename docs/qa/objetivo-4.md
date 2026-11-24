# QA — Objetivo 4: subtarefas e checklist

_24/11/2026. Critérios em `docs/project/escopo.md`. Navegador: Chromium, fuso America/Sao_Paulo, relógio fixado
em terça 24/11/2026 10:00._

| # | Critério | Unidade | Navegador |
|---|---|---|---|
| 1 | Subtarefa pelo quick-add, na lista da mãe (ignora `~outra`) | `subtarefas-db.test.ts` | Passou |
| 2 | Abrir subtarefa e voltar para a mãe | — | Passou |
| 3 | Até o 5º nível; depois, aviso e sem campo | `hierarquia.test.ts`, `subtarefas-db.test.ts` | Passou |
| 4 | Progresso na linha; subtarefas fora de Tudo e das listas; com data aparecem em Hoje/Amanhã/7 dias indicando a mãe | `hierarquia.test.ts` | Passou |
| 5 | Concluir a mãe conclui as filhas abertas; reabrir a mãe não reabre as filhas | `hierarquia.test.ts`, `subtarefas-db.test.ts` | Passou |
| 6 | Lixeira leva as filhas; só a mãe aparece; restaurar traz as que foram junto | `hierarquia.test.ts`, `subtarefas-db.test.ts` | Passou |
| 7 | Mudar a mãe de lista leva as filhas | `subtarefas-db.test.ts` | Passou |
| 8 | Mãe recorrente avança e reabre subtarefas e checklist | `hierarquia.test.ts`, `subtarefas-db.test.ts` | Passou |
| 9 | Adicionar item; campo fica pronto para o próximo; ordem de criação | `subtarefas-db.test.ts` | Passou |
| 10 | Marcar item atualiza contador no painel e na lista | `hierarquia.test.ts` | Passou |
| 11 | Renomear item; vazio volta ao anterior com aviso | `subtarefas-db.test.ts` | Passou |
| 12 | Remover item (exclusão lógica) | `subtarefas-db.test.ts` | Passou |
| 13 | Persiste ao recarregar e funciona offline | `subtarefas-db.test.ts` | Passou |

Extras: atualização do banco da versão 2 para a 3 mantém tarefas e finanças; 375 px sem rolagem horizontal; sem
erros no console; roteiros dos objetivos 2 (24/24) e 3 (16/16) rodados de novo.
Comandos: `pnpm test` (131 no core, 25 no web), `pnpm typecheck`, `pnpm lint` (0 erros), `pnpm build`.

## Defeito achado e corrigido
- **Média:** ids gerados no mesmo milissegundo podiam sair fora de ordem (a parte final do UUID v7 é aleatória),
  trocando a ordem de itens do checklist criados em sequência rápida. `uuidv7()` agora é monotônico (contador no
  mesmo milissegundo, método 1 da RFC 9562).

## Observações (não bloqueiam)
- Uma subtarefa recorrente cuja mãe é concluída fica concluída (não avança sozinha).
- A cópia de histórico de uma mãe recorrente não leva as subtarefas nem o checklist daquela ocorrência.
