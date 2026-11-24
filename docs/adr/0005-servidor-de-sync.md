# ADR 0005 — Servidor de sincronização: documentos por registro com relógio por campo

- **Status:** aceito
- **Data:** 2026-11-24
- **Autor:** architect
- **Revisado por:** backend, frontend, qa

## Contexto
O app web grava tudo no IndexedDB (Dexie) e precisa sincronizar entre aparelhos (plano, "Sync offline-first").
O plano descreve: id UUID v7 gerado no aparelho, `server_version` de uma sequência global, exclusão lógica,
push só com os campos alterados e, no mesmo campo, vence a edição mais recente. O back-end é Python (ADR 0002).
Os tipos do app vivem em TypeScript (`@ticktick/core`); repetir 17 tabelas tipadas em SQLAlchemy agora dobraria o
trabalho a cada campo novo, antes mesmo de existir um consumidor no servidor.

## Decisão
**Armazenamento:** uma tabela `registros` com um documento JSONB por registro do app:

| coluna | o que é |
|---|---|
| `usuario_id`, `tabela`, `id` | chave primária (o `id` é o do aparelho; `inbox` é o id fixo da Inbox) |
| `dados` | o registro como o app o vê (JSONB) |
| `relogios` | para cada campo, quando ele foi alterado (`{"titulo": "2026-11-24T13:00:00Z", ...}`) |
| `server_version` | número da sequência global `versao_registros`, renovado a cada mudança aceita |

Tabelas aceitas: as mesmas do Dexie (`tarefas`, `listas`, `itensChecklist`, `movs`, `metas`), para o cliente
não precisar traduzir nomes. Novas tabelas entram na lista em `sync.py`.

**Contrato:**
```
POST /api/sync/push   {"mudancas": [{"tabela": "tarefas", "id": "0193…", "campos": {"titulo": "x"},
                                     "alterado_em": "2026-11-24T13:00:00Z"}]}
  → {"resultados": [{"tabela", "id", "aplicados": ["titulo"], "ignorados": [], "server_version": 42}],
     "versao": 42}

GET  /api/sync/pull?since=40&limite=500
  → {"registros": [{"tabela", "id", "dados": {…}, "server_version": 41}, …], "versao": 42, "mais": false}
```
- **Por campo, vence o mais recente:** cada campo da mudança só é aplicado se `alterado_em` for maior que o relógio
  daquele campo. Empate ou mais antigo: ignorado (e listado em `ignorados`). Assim o push é idempotente.
- `alterado_em` no futuro (relógio do aparelho adiantado) é tratado como "agora", para uma edição não vencer
  todas as outras para sempre.
- Exclusão lógica é só o campo `excluidoEm`; nada é apagado do banco.
- Só muda `server_version` quando algum campo foi aplicado.
- Limites: até 500 mudanças por lote, até 100 campos por mudança, nomes de campo `[A-Za-z][A-Za-z0-9_]*`,
  documento até 64 KB.

**Login:** usuário único criado por comando (`criar-usuario`), senha com Argon2. Sessão em cookie `HttpOnly`,
`SameSite=Lax` (e `Secure` em produção), guardada no banco só como hash SHA-256, válida por 90 dias. Login errado
5 vezes em 1 minuto pelo mesmo IP → 429. O app e a API ficam na mesma origem (Caddy serve `/` e repassa `/api`),
então não há CORS; o corpo JSON obrigatório nas rotas `POST` protege contra envio de formulário de outro site.

## Alternativas consideradas
| Opção | Prós | Contras |
|---|---|---|
| Tabelas tipadas por entidade (como no plano) | Consultas e índices por coluna; integridade no banco | Repetir o modelo TS em Python a cada mudança; migração por campo novo |
| **Documento JSONB + relógio por campo (escolhida)** | Um caminho de sync para todas as entidades; campo novo no app não exige migração | Consultas do servidor (lembretes, REST) usam JSONB; exige índices de expressão quando precisar |
| PowerSync / ElectricSQL | Sync pronto | Mais uma peça para hospedar; o plano prefere o sync próprio para um usuário só |

## Consequências
- O worker de lembretes (próximos objetivos) vai consultar `dados->>'data'`, `dados->>'hora'` etc.; quando
  existir, ganha índices de expressão ou uma tabela derivada `lembretes`.
- O cliente precisa guardar, por registro alterado offline, quando cada campo mudou (fila de saída no Dexie).
- Validação de tipo dos campos (ex.: `prioridade` 0–3) continua no app (`@ticktick/core`); o servidor só garante
  forma, tamanho e dono. Uma API REST de escrita para integrações vai precisar de validação própria.
