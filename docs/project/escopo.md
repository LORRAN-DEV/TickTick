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

## Objetivo 4 — Subtarefas e checklist (concluído)

**Por quê:** o plano põe subtarefas (até 5 níveis) e checklist dentro da tarefa no MVP. Subtarefa é uma tarefa de
verdade (tem data, prioridade, pode ter suas próprias subtarefas); item de checklist é só um texto marcável.

**Dentro:** criar, concluir e abrir subtarefas pelo painel da tarefa-mãe; navegar de volta para a mãe; adicionar,
marcar, renomear e remover itens de checklist; contadores na lista.

**Fora:** arrastar para reordenar, transformar item de checklist em subtarefa, mover subtarefa para outra mãe.

### Critérios de aceite — subtarefas
1. **No** painel de uma tarefa, **quando** digito no campo "Adicionar subtarefa" (aceita o quick-add, ex.:
   `comprar tinta amanhã !alta`) e aperto Enter, **então** a subtarefa aparece no painel, na mesma lista da mãe.
2. **Quando** clico numa subtarefa, **então** o painel passa a mostrá-la, com um link para voltar à mãe.
3. Subtarefas podem ter subtarefas até o **5º nível**; no 5º, o campo de adicionar some e há um aviso.
4. **Na lista**, a tarefa-mãe mostra o progresso (ex.: `1/3`); as subtarefas **não** aparecem soltas em Tudo nem
   nas listas comuns. **Em** Hoje, Amanhã e Próximos 7 dias, uma subtarefa **com data** aparece, indicando a mãe.
5. **Quando** concluo a mãe, **então** as subtarefas abertas são concluídas junto. Reabrir a mãe não reabre as filhas.
6. **Quando** mando a mãe para a lixeira, **então** as subtarefas vão junto; **quando** restauro a mãe, **então**
   voltam as que foram junto com ela. Na Lixeira aparece só a mãe.
7. **Quando** mudo a mãe de lista, **então** as subtarefas mudam junto.
8. **Dada** uma mãe recorrente, **quando** concluo, **então** ela avança e as subtarefas e itens do checklist voltam
   a ficar abertos para a próxima ocorrência.

### Critérios de aceite — checklist
9. **No** painel, **quando** digito em "Adicionar item" e aperto Enter, **então** o item aparece no fim do checklist
   e o campo continua pronto para o próximo.
10. **Quando** marco um item, **então** ele aparece riscado e o contador (ex.: `1/3`) atualiza no painel e na lista.
11. **Quando** edito o texto de um item e saio do campo, **então** salva; texto vazio volta ao anterior.
12. **Quando** removo um item, **então** ele some (exclusão lógica).
13. Tudo persiste ao recarregar e funciona offline.

## Objetivo 5 — PWA: instalar e abrir sem internet (concluído)

**Por quê:** o plano é um PWA offline-first que "instala no celular e no Windows". Os dados já ficam no aparelho;
falta o próprio app (HTML, JS, CSS) abrir sem rede e poder ser instalado.

**Dentro:** manifesto com nome, ícones e cores; service worker que guarda o app em cache; aviso de nova versão;
botão "Instalar" quando o navegador oferece.

**Fora:** notificações push (dependem do servidor), sincronização em segundo plano.

### Critérios de aceite
1. O app tem manifesto válido: nome "TickTick", abre em tela própria (`standalone`), `start_url` `/`, cor do tema
   e ícones de 192 e 512 px (inclusive versão `maskable` para Android).
2. **Dado** que abri o app uma vez com internet, **quando** fico sem internet e abro ou recarrego `/` ou
   `/financas`, **então** o app abre normalmente, com meus dados.
3. **Na** primeira visita, **quando** o app termina de ficar disponível offline, **então** aparece um aviso
   "Pronto para usar sem internet".
4. **Dado** que publiquei uma nova versão, **quando** abro o app, **então** aparece um aviso com o botão "Atualizar";
   o app não recarrega sozinho (para não perder o que estou digitando).
5. **Quando** o navegador permite instalar, **então** aparece um botão "Instalar" no menu; depois de instalado, some.
6. Nada muda nos dados guardados (IndexedDB) ao instalar ou atualizar.

## Objetivo 6 — Suíte de testes de ponta a ponta e integração contínua (concluído)

**Por quê:** os critérios dos objetivos 1 a 5 foram verificados com roteiros avulsos, fora do repositório. Sem
eles versionados, uma mudança futura pode quebrar algo sem ninguém ver. O plano prevê Playwright e CI.

**Dentro:** pacote `tests/` com Playwright cobrindo os critérios de aceite dos objetivos 1 a 5, rodando contra o
build de produção; comando `pnpm e2e`; workflow do GitHub Actions rodando testes, tipos, lint, build e e2e a cada push.

### Critérios de aceite
1. `pnpm e2e` sobe o app sozinho (build + servidor estático), roda a suíte e encerra tudo, sem deixar processos.
2. Cada critério dos objetivos 1 a 5 que dá para verificar no navegador tem um teste com o número do critério no nome.
3. Os testes são determinísticos: relógio fixado em terça 24/11/2026 10:00 em São Paulo; nada depende da data real.
4. A suíte passa 3 vezes seguidas sem falhas (sem testes instáveis).
5. O GitHub Actions roda `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` e `pnpm e2e` em cada push e pull request.
