# QA — Objetivo 2: tela de tarefas com quick-add

_24/11/2026. Critérios em `docs/project/escopo.md`. Navegador: Chromium, fuso America/Sao_Paulo, relógio fixado
em terça 24/11/2026 10:00 (e depois em 26/11 para conferir atrasadas)._

| # | Critério | Unidade | Navegador |
|---|---|---|---|
| 1 | Prévia do quick-add (título, data, hora, prioridade, tag) | `tarefas.test.ts` (core) | Passou |
| 2 | Enter cria a tarefa completa e limpa o campo | `tarefas-db.test.ts` | Passou |
| 3 | Inbox por padrão; `~lista` cria a lista uma vez e a mostra na barra lateral | `tarefas-db.test.ts` | Passou |
| 4 | Listas inteligentes e ordem (atrasadas no topo, sem data no fim) | `tarefas.test.ts` | Passou |
| 5 | Concluir e reabrir | `tarefas-db.test.ts` | Passou |
| 6 | Recorrente avança (30/11 → 07/12) e guarda cópia concluída | `proxima.test.ts`, `tarefas-db.test.ts` | Passou |
| 7 | Lixeira e restaurar | `tarefas-db.test.ts` | Passou |
| 8 | Persiste ao recarregar e funciona offline | `tarefas-db.test.ts` | Passou |
| 9 | Menu Tarefas ↔ Finanças; Tarefas é a página inicial | — | Passou |

Extras verificados: título vazio é recusado com aviso; 375 px de largura sem rolagem horizontal; sem erros no
console; atualização do banco da versão 1 para a 2 mantém as finanças; concluir duas vezes ao mesmo tempo não
duplica. Comandos: `pnpm test` (105 no core, 16 no web), `pnpm typecheck`, `pnpm lint` (0 erros), `pnpm build`.

## Observações (não bloqueiam)
- **Baixa:** uma data sem ano no passado (`20/11` em 24/11) vira o próximo ano. É a regra do parser, documentada
  no README; não dá para criar tarefa atrasada digitando a data. Se incomodar no uso, rever no parser.
- **Baixa:** no celular, as listas inteligentes rolam na horizontal; "Concluídas" e "Lixeira" ficam fora da tela
  até rolar.
- A suíte e2e versionada em `tests/` continua pendente (os roteiros do navegador ainda são avulsos).
