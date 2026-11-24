# ADR 0008 — Lembretes: campo da tarefa, varredura por minuto e Web Push

- **Status:** aceito
- **Data:** 2026-11-24
- **Autor:** architect
- **Revisado por:** backend, frontend, qa

## Contexto
O plano manda o servidor ser a fonte da verdade dos lembretes (o navegador não garante timers com o app fechado):
calcular o próximo disparo, um job a cada minuto e Web Push para todos os aparelhos, com "Concluir" e "Adiar".
Os dados do app chegam ao servidor como documentos JSONB (ADR 0005) e a regra de concluir (recorrência, cascata)
existe só em TypeScript (`@ticktick/core`). O servidor roda no PC de casa (ADR 0007), com um usuário.

## Decisão
- **Lembretes são um campo da tarefa**: `lembretes: [{ "antes": minutos }]`, sincronizado como qualquer campo.
  Referência: `data` + `hora` da tarefa no fuso do usuário; sem `hora`, 09:00. Disparo = referência − `antes`.
  Recorrentes lembram a ocorrência atual (a `data` já avança ao concluir).
- **Worker** `ticktick-api lembretes` (serviço próprio no compose): a cada minuto, lê as tarefas abertas, sem
  `excluidoEm`, com data e lembretes; envia os disparos vencidos há no máximo 6 h que ainda não constam em
  `lembretes_enviados` (chave: tarefa + instante do disparo), e os adiamentos vencidos. Sem fila externa: um laço
  simples com `SELECT … FOR UPDATE SKIP LOCKED` nos adiamentos basta para um usuário (pg-boss/Procrastinate seriam
  peça a mais).
- **Web Push** com `pywebpush` e chaves VAPID geradas pelo servidor na primeira vez e guardadas no banco
  (`config_servidor`); o app pega a chave pública em `GET /api/push/chave`. Inscrições em `push_assinaturas`;
  resposta 404/410 do serviço de push apaga a inscrição. O fuso do usuário vem do aparelho ao se inscrever.
- **Ações na notificação** (service worker, `public/sw-push.js` importado pelo SW do Workbox):
  "Adiar 10 min" chama `POST /api/lembretes/adiar` (o servidor guarda e reenvia); "Concluir" abre o app em
  `/?concluir=<id>`, e o app conclui com a regra do core e sincroniza.
- O contato VAPID (`sub`) é genérico por padrão, configurável em `TICKTICK_VAPID_CONTATO`: nenhum dado pessoal vai
  para o serviço de push.

## Alternativas consideradas
| Opção | Prós | Contras |
|---|---|---|
| Tabela `reminders` separada no app (como no plano) | Consultas diretas | Mais uma tabela sincronizada e telas para ela; o campo na tarefa cobre o MVP |
| Concluir pelo servidor | Funciona sem abrir o app | Duplicar recorrência e cascata em Python |
| Timer no navegador (Notification API) | Sem servidor | Não dispara com o app fechado |
| **Campo + worker + Web Push (escolhida)** | Segue o plano; um caminho de sync | Concluir abre o app |

## Consequências
- O worker precisa do PC ligado (ADR 0007). Atraso de até 6 h ainda notifica, depois descarta.
- iPhone só recebe push com o PWA na tela inicial (iOS 16.4+); o humano usa Android.
- Lembrete por e-mail e lembrete constante (fase 2) reaproveitam o mesmo worker.
