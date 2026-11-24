# QA — Objetivo 3: detalhe da tarefa

_24/11/2026. Critérios em `docs/project/escopo.md`. Navegador: Chromium, fuso America/Sao_Paulo, relógio fixado
em terça 24/11/2026 10:00._

| # | Critério | Unidade | Navegador |
|---|---|---|---|
| 1 | Painel abre com os campos preenchidos; Esc e "Fechar" fecham | — | Passou |
| 2 | Mudanças aparecem na lista na hora e persistem | `tarefas-db.test.ts` | Passou |
| 3 | Título vazio volta ao anterior, com aviso, sem gravar | `edicao.test.ts`, `tarefas-db.test.ts` | Passou |
| 4 | Tags normalizadas como no quick-add | `edicao.test.ts` | Passou |
| 5 | Hora só com data; tirar a data tira hora e repetição | `edicao.test.ts` | Passou |
| 6 | Opções prontas de repetição; sem data usa hoje; regra do quick-add mantida com o nome dela | `edicao.test.ts` | Passou |
| 7 | Mudar a data leva "toda semana"/"todo mês" junto | `edicao.test.ts` | Passou |
| 8 | Concluir (recorrente avança) e lixeira pelo painel fecham o painel | — | Passou |
| 9 | Toda mudança atualiza `atualizadoEm` | `edicao.test.ts`, `tarefas-db.test.ts` | Passou |

Extras: painel cabe em 375 px; sem erros no console; roteiro do objetivo 2 rodado de novo (24/24).
Comandos: `pnpm test` (118 no core, 17 no web), `pnpm typecheck`, `pnpm lint` (0 erros), `pnpm build`.

## Observações (não bloqueiam)
- Ao abrir, o foco vai para o botão de fechar (padrão do componente), não para o título.
- Notas são texto puro; renderizar Markdown ficou fora deste objetivo.
