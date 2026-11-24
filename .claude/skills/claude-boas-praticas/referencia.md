# Referência rápida (Claude Code, nov/2026)

Fonte: documentação oficial em https://code.claude.com/docs — confira lá se algo parecer desatualizado.

## Ativar agent teams
```json
// .claude/settings.json ou ~/.claude/settings.json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }, "teammateMode": "auto" }
```
- `teammateMode`: `in-process` (padrão, qualquer terminal), `auto`, `tmux`, `iterm2` (painéis divididos).
- Só funciona em sessão interativa (não em `claude -p`).
- In-process: ↑/↓ seleciona teammate, Enter abre/mensagem, `x` para, Ctrl+T mostra a lista de tarefas.

## Arquitetura de um time
- **Lead**: sessão principal (fixa; não dá para trocar o lead).
- **Teammates**: instâncias independentes, cada uma com seu contexto.
- **Lista de tarefas**: pending → in_progress → completed, com dependências e trava contra disputa.
- **Mailbox**: mensagens diretas por nome (uma por destinatário; não há broadcast).

## Definição de agente usada como teammate
O que é aplicado: `tools` (+ SendMessage e Task tools adicionados), `model`, `disallowedTools`
(in-process), `effort` (in-process), corpo do arquivo (como instruções extras).
O que **não** é aplicado: `skills` (teammate carrega as skills do projeto/usuário).

## Frontmatter de `.claude/agents/*.md`
Obrigatórios: `name`, `description`.
Opcionais: `tools`, `disallowedTools`, `model` (`sonnet`|`opus`|`haiku`|`fable`|ID|`inherit`),
`permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory` (`user`|`project`|`local`),
`background`, `effort`, `isolation: worktree`, `color`, `initialPrompt` (só quando roda como sessão principal).

Locais (precedência): managed > `--agents` > `.claude/agents/` > `~/.claude/agents/` > plugin.
Validar: `claude plugin validate .claude/agents`; diagnosticar: `claude --debug`.
Crie a pasta `.claude/agents/` antes de abrir a sessão (o watcher só vê pastas existentes no início).

## Frontmatter de `SKILL.md`
`name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`,
`user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context: fork`, `agent`,
`background`, `hooks`, `paths`, `shell`, `metadata`.
Para subir no claude.ai/API, use só: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`.
Locais: `~/.claude/skills/<nome>/` (pessoal), `.claude/skills/<nome>/` (projeto), `<plugin>/skills/<nome>/`.

## Hooks úteis para times
- `TeammateIdle` — antes de um teammate ficar ocioso; exit 2 devolve feedback e mantém trabalhando.
- `TaskCreated` — exit 2 bloqueia a criação da tarefa com feedback.
- `TaskCompleted` — exit 2 impede marcar como concluída (ótimo para exigir testes passando).
- Também: `PreToolUse`, `PostToolUse`, `Stop`/`SubagentStop`.

## Outras peças
- **Cross-session messaging**: passar achados entre sessões suas sem montar time.
- **Worktrees**: sessões paralelas no mesmo repo sem conflito.
- **Plugins**: empacotar agentes + skills + hooks + MCP para reusar/compartilhar.
- **Agent SDK**: o mesmo motor do Claude Code, programável, para automações fora do terminal.
- **Cache**: `subagentPromptCacheTtl: "1h"` mantém cache de teammates por mais tempo (custa mais na escrita).
