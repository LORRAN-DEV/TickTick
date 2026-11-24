# ADR 0006 — Cliente de sync: fila de saída por middleware do Dexie

- **Status:** aceito
- **Data:** 2026-11-24
- **Autor:** architect
- **Revisado por:** frontend, backend, qa

## Contexto
O servidor aceita mudanças por campo com `alterado_em` (ADR 0005). O app grava no IndexedDB por cerca de 15
funções em `apps/web/src/db/` (e mais virão). Precisamos saber, para cada registro, quais campos mudaram e quando,
sem depender de cada função lembrar de avisar — e sem perder a mudança se o app fechar logo depois de gravar.

## Decisão
- **Fila de saída** numa tabela `fila` do Dexie (`++seq, tabela, registroId, campos, alteradoEm`).
- **Middleware DBCore** (`src/db/sync/fila.ts`) nas tabelas sincronizadas (`tarefas`, `listas`,
  `itensChecklist`, `movs`, `metas`): em todo `add`/`put` lê o registro anterior, compara campo a campo e grava os
  campos alterados na `fila` **na mesma transação** do IndexedDB (o middleware inclui `fila` no escopo de toda
  transação de escrita). Campo removido vai como `null`. Nada muda → nada entra na fila.
- **`null`** chega do servidor como `null` e fica `null` (em `hora`/`data`/`rrule` é valor de verdade; nos opcionais
  o app já trata `null` como "sem valor").
- **Gravações vindas do servidor** passam pelo mesmo caminho com uma marca interna (`__remoto`), que o middleware
  retira antes de gravar e que impede de reenfileirar.
- **Sync** (`src/db/sync/sync.ts`): primeiro envia a fila em lotes de 500 (apaga o que o servidor confirmou),
  depois puxa desde a última versão guardada e aplica; ao aplicar, campos com mudança local ainda na fila ficam
  como estão (a mudança local vai subir e o servidor decide pelo horário).
- **Primeiro login no aparelho:** a fila é trocada por um retrato de tudo que existe (cada registro inteiro, com
  `alterado_em` = `atualizadoEm` dele), exceto dados de exemplo nunca alterados (marcados `exemplo: true` na
  criação), que são apagados deste aparelho.
- **Aparelho sem conta** não faz chamada de rede nenhuma; aparelho com conta não cria dados de exemplo.
- **Quando sincroniza:** ao abrir, ao voltar a conexão, ao voltar para a aba, 1,5 s depois da última mudança e a
  cada 60 s. Sem login, nada disso roda.

## Alternativas consideradas
| Opção | Prós | Contras |
|---|---|---|
| Cada função de `src/db/` registra na fila | Explícito | Fácil esquecer numa função nova; cascatas e `modify` em lote exigem cuidado em cada lugar |
| Hooks `creating/updating` do Dexie | API simples | Não podem escrever em outra tabela fora do escopo da transação |
| Registrar depois do `commit` | Simples | Mudança perdida para o sync se o app fechar entre o commit e a fila |
| **Middleware DBCore (escolhida)** | Pega toda gravação, atômico com ela | Código de nível mais baixo; testado com fake-indexeddb |

## Consequências
- Exclusão física (`delete`) em tabela sincronizada não sobe para o servidor: use sempre exclusão lógica.
- O horário de cada campo é o relógio do aparelho; o servidor limita relógios adiantados (ADR 0005).
- Em desenvolvimento, o Vite repassa `/api` para `http://127.0.0.1:8000`; em produção, Caddy na mesma origem.
