# Escopo

O plano completo está em `docs/project/plano.md`. Este arquivo guarda o escopo e os critérios de aceite
do objetivo em andamento e dos próximos.

> **Fora do plano original:** o controle financeiro foi acrescentado pelo humano. Segue as mesmas regras de
> dados do plano (id gerado no aparelho, datas de criação/alteração, exclusão lógica) para poder sincronizar
> junto com as tarefas quando houver servidor.

## Objetivo 1 — Guardar as finanças no navegador (concluído)

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

## Objetivo 2 — Tela de tarefas com quick-add (concluído)

**Por quê:** é o coração do MVP do plano ("capturar e organizar"). O parser já existe; falta a tela e o banco.

**Dentro:** campo de quick-add que mostra o que foi reconhecido enquanto se digita; Inbox e listas (criadas pelo
`~lista`); listas inteligentes Hoje, Amanhã, Próximos 7 dias, Tudo, Concluídas e Lixeira; concluir, reabrir,
"não vou fazer", mandar para a lixeira e restaurar; tarefas recorrentes avançam para a próxima data ao concluir;
navegação entre Tarefas e Finanças.

**Fora (próximos objetivos):** editar a tarefa depois de criada, notas, subtarefas e checklist, pastas, lembretes e
notificações, arrastar para reordenar, "editar só esta" ocorrência.

### Critérios de aceite
1. **Dado** que digito `pagar boleto amanhã 15h !alta #casa`, **então**, antes de salvar, vejo reconhecidos: amanhã,
   15:00, prioridade alta e a tag casa, e o título "pagar boleto".
2. **Quando** aperto Enter, **então** a tarefa aparece com título "pagar boleto", data de amanhã, 15:00, prioridade
   alta e tag casa, e o campo fica vazio.
3. **Dado** uma tarefa sem `~lista`, **então** ela vai para a Inbox; **dado** `~trabalho`, **então** vai para a lista
   "trabalho", que é criada se não existir e aparece na barra lateral.
4. **Hoje** mostra as tarefas abertas de hoje e as atrasadas; **Amanhã** as de amanhã; **Próximos 7 dias** de hoje até
   hoje + 6, mais as atrasadas; **Tudo** todas as abertas; **Concluídas** as concluídas e "não vou fazer"; **Lixeira**
   as apagadas. Ordem: atrasadas e mais cedo primeiro, sem data por último; no mesmo horário, maior prioridade primeiro.
5. **Quando** concluo uma tarefa comum, **então** ela sai das listas abertas e aparece em Concluídas; **quando** a reabro,
   **então** volta.
6. **Dado** `academia toda segunda 7h` vencendo nesta segunda, **quando** concluo, **então** a tarefa passa para a próxima
   segunda e uma cópia concluída da ocorrência vai para Concluídas.
7. **Quando** mando para a lixeira, **então** some das outras listas e aparece na Lixeira; **quando** restauro, **então** volta.
8. Tudo continua depois de recarregar a página e funciona sem internet.
9. Há um menu para ir de Tarefas para Finanças e voltar; Tarefas é a página inicial.

## Objetivo 3 — Detalhe da tarefa: editar depois de criada (concluído)

**Por quê:** hoje, errou no quick-add, só apagando e criando de novo. O plano prevê título, notas, prioridade,
tags, data/hora e repetição na tarefa.

**Dentro:** painel de detalhe ao clicar numa tarefa, com título, data, hora, prioridade, tags, lista, repetição e
notas; salva sozinho (como no TickTick), sem botão "Salvar"; concluir e mandar para a lixeira dali.

**Fora:** renderizar o Markdown das notas (por enquanto texto puro, com quebras de linha), subtarefas, checklist,
anexos, lembretes, repetição personalizada além das opções prontas.

### Critérios de aceite
1. **Quando** clico no título de uma tarefa, **então** abre um painel com todos os campos preenchidos; Esc ou "Fechar" fecha.
2. **Quando** mudo título, data, hora, prioridade, lista ou notas, **então** a mudança aparece na lista na hora e
   continua depois de recarregar.
3. **Dado** o título apagado, **quando** saio do campo, **então** o título anterior volta e aparece um aviso.
4. **Tags:** digito `casa, #Mercado urgente` e saio do campo, **então** a tarefa fica com as tags casa, mercado e
   urgente (minúsculas, sem `#`, sem repetir), igual ao quick-add.
5. **Hora** só pode ser escolhida com data; **quando** tiro a data, **então** a hora e a repetição saem junto.
6. **Repetição:** opções Não repete, Todo dia, Toda semana (no dia da semana da data), Dias úteis, Todo mês (no dia
   da data) e Todo ano. **Dada** uma tarefa sem data, **quando** escolho uma repetição, **então** a data vira hoje.
   Regras criadas pelo quick-add que não são uma dessas opções (ex.: "toda seg, qua, sex") aparecem com o nome delas
   e continuam valendo até eu escolher outra.
7. **Quando** mudo a data de uma tarefa "toda semana" ou "todo mês", **então** a regra acompanha o novo dia.
8. **Quando** concluo ou mando para a lixeira pelo painel, **então** o painel fecha e a tarefa sai da lista.
9. Cada mudança atualiza `atualizadoEm` (para o sync futuro).
