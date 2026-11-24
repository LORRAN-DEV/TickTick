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

## Objetivo 7 — API em Python: login e sincronização (concluído)

**Por quê:** é a base para usar o app em mais de um aparelho e, depois, para os lembretes (o servidor dispara
mesmo com o app fechado). Pelo plano, o app conversa com o servidor por três rotas de sync; o resto da API REST é
para integrações e vem depois.

**Dentro:** `apps/api` em FastAPI + PostgreSQL (ADR 0002); usuário único criado por comando; login/logout com
cookie de sessão; `POST /api/sync/push` e `GET /api/sync/pull`; testes com pytest num Postgres real; job no CI.

**Fora (próximos objetivos):** o app web usando o sync (fila de saída no Dexie), avisos em tempo real (SSE),
lembretes e Web Push, API REST de integrações, `docker compose` + Caddy.

### Critérios de aceite
1. `uv run ticktick-api criar-usuario <email>` cria o usuário pedindo a senha (guardada com Argon2, nunca em texto).
2. `POST /api/auth/login` com e-mail e senha certos devolve um cookie de sessão `HttpOnly`; errados, 401 sem dizer
   qual dos dois errou. Depois de 5 tentativas erradas em 1 minuto, 429.
3. Sem sessão válida, as rotas de sync respondem 401. `POST /api/auth/logout` invalida a sessão no servidor.
4. `POST /api/sync/push` recebe um lote de mudanças `{tabela, id, campos, alterado_em}` das tabelas do app
   (`tarefas`, `listas`, `itensChecklist`, `movs`, `metas`) e grava; tabela desconhecida ou lote inválido → 422.
5. **Conflito por campo:** editar o título no aparelho A e a data no aparelho B não conflita (os dois valem);
   no mesmo campo vence a edição mais recente (`alterado_em`). Uma mudança vinda "do futuro" conta como agora.
6. Mandar o mesmo lote duas vezes não muda nada na segunda (idempotente) nem gera versão nova.
7. `GET /api/sync/pull?since=N` devolve só os registros alterados depois da versão N, em ordem, em páginas
   (`mais: true` quando há mais), e a versão para pedir a próxima página.
8. Exclusão é lógica: `excluidoEm` é um campo como os outros e o registro continua vindo no pull.
9. Um usuário nunca vê nem altera registros de outro.
10. `uv run pytest` roda os testes contra PostgreSQL; o CI roda a API num job próprio com Postgres.

## Objetivo 8 — App web sincronizando com a API (concluído)

**Por quê:** a API existe (objetivo 7), mas o app ainda não a usa. Com isto, os mesmos dados aparecem em todos os
aparelhos, continuando a funcionar offline.

**Dentro:** página "Conta" com login e logout; fila de saída no banco local registrando cada campo alterado;
sincronização automática (ao abrir, ao voltar a conexão, logo depois de cada mudança e a cada minuto) e botão
"Sincronizar agora"; indicador de estado no menu. O app continua funcionando sem conta.

**Fora:** avisos em tempo real (SSE), lembretes, resolver conflito com escolha do usuário (vale a regra do ADR 0005).

### Critérios de aceite
1. Sem login, o app funciona como antes; o menu mostra "Conta" sem indicador de sincronização.
2. **Na** página Conta, **quando** entro com e-mail e senha certos, **então** vejo "Sincronizado" e meu e-mail;
   com dados errados, vejo "E-mail ou senha incorretos". "Sair" encerra a sessão e para de sincronizar.
3. **Dado** que entrei no aparelho A, **quando** crio ou altero tarefas, listas, checklist, movimentações ou metas,
   **então**, em poucos segundos, elas chegam ao servidor sem eu fazer nada.
4. **Dado** o aparelho B logado na mesma conta, **quando** ele sincroniza, **então** mostra o que foi feito no A
   (e vice-versa), inclusive exclusões (lixeira).
5. **Conflito:** título alterado no A e data alterada no B, offline, viram os dois quando ambos sincronizam;
   no mesmo campo, vale a alteração mais recente.
6. **Offline:** o que faço sem internet fica na fila (o menu mostra "Offline" e quantas mudanças estão pendentes)
   e sobe sozinho quando a conexão volta.
7. **Primeiro login no aparelho:** o que já existia nele (criado antes de entrar) é enviado; os dados de exemplo
   nunca alterados não são enviados e saem deste aparelho.
8. Se a sessão expira, o app avisa "Entre de novo para sincronizar" e não perde as mudanças da fila.

## Objetivo 9 — Implantação com Docker Compose e backup (concluído)

**Por quê:** para usar o app de verdade em mais de um aparelho, o servidor precisa rodar sempre ligado. O plano:
"Tudo sobe com um `docker compose up`", com Caddy dando HTTPS e backup diário do Postgres.

**Dentro:** imagens da API e do app web (Caddy servindo o build e repassando `/api`); Postgres com volume;
serviço de backup diário com `pg_dump`, guardando 14 dias; `.env.example`; guia de hospedagem; job no CI que sobe
tudo e confere.

**Fora:** escolher onde hospedar (decisão pendente do humano), acesso remoto (Tailscale/Cloudflare Tunnel),
restaurar backup pela interface.

### Critérios de aceite
1. Com um `.env` preenchido, `docker compose up -d --build` (em `infra/`) sobe Postgres, API, app e backup, e todos
   ficam saudáveis.
2. `https://<domínio>/` abre o app; `/financas` (rota do app) também; `/api/saude` responde pela API.
3. `docker compose run --rm api ticktick-api criar-usuario <email>` cria o usuário; o login pelo app funciona e o
   cookie de sessão é `Secure`.
4. `sw.js`, o manifesto e o HTML vão com `Cache-Control: no-cache`; `assets/` com cache longo.
5. O serviço de backup gera um arquivo `ticktick-AAAA-MM-DD.dump` ao subir e depois uma vez por dia, apagando os de mais
   de 14 dias; o guia mostra como restaurar.
6. Os dados sobrevivem a `docker compose down` + `up` (volume do Postgres).
7. O CI sobe o compose e verifica os itens 1 a 4 a cada push.

## Objetivo 10 — Lembretes com notificação no celular (concluído)

**Por quê:** "capturar e ser lembrado" é o núcleo do MVP. Sem lembrete, uma tarefa com hora passa despercebida.

**Dentro:** um ou mais lembretes por tarefa (na hora, 5/15/30 min, 1 h ou 1 dia antes); tarefa criada com hora já
vem com lembrete "na hora"; ativar notificações por aparelho na página Conta, com notificação de teste; o servidor
envia Web Push no horário, mesmo com o app fechado; botões "Concluir" e "Adiar 10 min" na notificação.

**Fora:** lembrete por e-mail e lembrete constante (fase 2 do plano), horário personalizado, lembrete diário de
planejamento.

### Critérios de aceite
1. **No** painel da tarefa, **escolho** um ou mais lembretes; **na lista**, a tarefa mostra um sino com o resumo.
2. **Quando** crio `reunião amanhã 15h`, **então** ela já vem com lembrete "na hora"; sem hora, sem lembrete.
3. **Tarefa sem hora** com lembrete: o horário de referência é 09:00 do dia (ex.: "1 dia antes" = 09:00 da véspera).
4. **Na** página Conta, "Ativar notificações" pede permissão ao navegador e inscreve o aparelho; "Enviar teste" faz
   chegar uma notificação. Se o navegador bloquear, a página explica como liberar.
5. **No horário do lembrete** (no fuso do aparelho que se inscreveu), o servidor manda uma notificação com o título
   e a hora da tarefa para todos os aparelhos inscritos, mesmo com o app fechado. Cada lembrete sai uma vez só.
6. Tarefa concluída, na lixeira ou com a data mudada não dispara lembrete antigo. Recorrente: lembra a ocorrência atual.
7. "Adiar 10 min" na notificação faz ela voltar 10 minutos depois; "Concluir" conclui a tarefa (recorrente avança).
8. Se o servidor ficou desligado na hora, o lembrete sai quando ele voltar, se o atraso for de até 6 horas;
   depois disso, é descartado. Aparelho que desinstalou o app deixa de receber (inscrição vencida é apagada).
