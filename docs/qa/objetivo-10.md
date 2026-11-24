# QA — Objetivo 10: lembretes com notificação

_24/11/2026. Critérios em `docs/project/escopo.md`._

| # | Critério | Como foi verificado | Resultado |
|---|---|---|---|
| 1 | Vários lembretes por tarefa no painel; sino na lista; persiste | e2e `lembretes.spec.ts` | Passou |
| 2 | Com hora já vem "na hora"; sem hora, sem lembrete | core `tarefas.test.ts`, e2e | Passou |
| 3 | Sem hora, referência 09:00 ("1 dia antes" = 09:00 da véspera) | pytest `test_lembretes.py`, e2e (texto do painel) | Passou |
| 4 | Ativar notificações, teste, explicação quando bloqueado | pytest (inscrição, teste, 410), e2e (explicação) | Passou em parte: a inscrição real no Web Push só dá para testar no celular |
| 5 | Notificação no horário, no fuso do aparelho, uma vez só | pytest (varredura), e2e (push entregue ao service worker → notificação com título, hora e botões) | Passou |
| 6 | Concluída, lixeira ou data mudada não dispara o antigo; recorrente lembra a atual | pytest | Passou |
| 7 | "Adiar 10 min" e "Concluir" | pytest (adiamento), e2e (`/?concluir=` conclui e avança recorrente; `/?tarefa=` abre o detalhe) | Passou |
| 8 | Atraso até 6 h ainda avisa; inscrição vencida some | pytest | Passou |

Comandos: `pnpm test` (core 135, web 47), `pnpm test:api` (50), `pnpm e2e` com API 45/45 e sem API 40 + 5 pulados,
em rodadas repetidas; teste do push repetido 8 vezes sem falha.

## Achados
- O Chromium "headless shell" (padrão do Playwright) não mostra notificações; o projeto `pwa` usa o Chromium
  completo (`channel: "chromium"`), que roda contextos anônimos (por isso o teste de instalável ignora `in-incognito`).
- O teste do push ficou instável até escolher o registro do service worker já ativado; agora estável.

## Falta verificar no aparelho real
Inscrição no Web Push e chegada da notificação no Android com o app fechado: depende do serviço de push do Google,
que não roda nos testes automáticos. Roteiro: página Conta → Ativar notificações → Enviar teste; depois criar uma
tarefa para daqui a 3 minutos e fechar o app.
