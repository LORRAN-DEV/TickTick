# Escopo

O plano completo está em `docs/project/plano.md`. Este arquivo guarda o escopo e os critérios de aceite
do objetivo em andamento e dos próximos.

> **Fora do plano original:** o controle financeiro foi acrescentado pelo humano. Segue as mesmas regras de
> dados do plano (id gerado no aparelho, datas de criação/alteração, exclusão lógica) para poder sincronizar
> junto com as tarefas quando houver servidor.

## Objetivo 1 — Guardar as finanças no navegador (em andamento)

**Por quê:** hoje tudo que se digita na tela de finanças some ao recarregar a página. É o primeiro passo do
banco local (Dexie) que o plano prevê para o modo offline.

**Fora de escopo:** servidor, sync entre aparelhos, contas e categorias editáveis, importar/exportar.

### Critérios de aceite
1. **Dado** que registrei uma movimentação, **quando** recarrego a página, **então** ela continua na lista e nos totais.
2. **Dado** que marquei uma movimentação como paga ou não paga, **quando** recarrego, **então** o status se mantém.
3. **Dado** que apaguei uma movimentação ou meta, **quando** recarrego, **então** ela não volta. (Exclusão lógica:
   o registro fica marcado como excluído, sem sumir do banco, para o sync futuro.)
4. **Dado** que criei uma meta ou somei um valor a ela, **quando** recarrego, **então** a meta e o valor se mantêm.
5. **Dado** que é a primeira vez que abro o app, **então** vejo os dados de exemplo; **quando** uso "Começar do zero"
   e recarrego, **então** os exemplos não voltam.
6. **Dado** que estou sem internet, **quando** registro algo, **então** é gravado do mesmo jeito (o banco é local).
7. Cada registro tem id UUID v7 gerado no aparelho e datas de criação e alteração.

## Objetivo 2 — Tela de tarefas com quick-add (próximo)
A definir com o humano antes de começar. Ponto de partida no plano: "Tela de lista em 3 colunas com quick-add",
tabelas `lists`, `tasks`, `tags` e `checklist_items` no Dexie.
