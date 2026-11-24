# Time de Agentes para Claude Code

> **Neste repositório o time já está instalado**: `CLAUDE.md`, `.claude/` e `docs/adr/` estão na raiz,
> adaptados ao TickTick (pastas `packages/core`, `apps/web`, `apps/api` e comandos `pnpm`).
> O monitor de tokens fica em `tools/time-agentes/monitor/` e é instalado na sua máquina com
> `python3 tools/time-agentes/monitor/instalar.py`.

Seis papéis — **Tech Lead, Architect, Backend, Frontend, QA e Gerente de Projeto** — que trabalham
como um *agent team* do Claude Code: cada um é uma instância independente, eles conversam
diretamente por mensagem, compartilham uma lista de tarefas e registram decisões em arquivos.

## O que tem aqui

```
CLAUDE.md                       Protocolo do time (todos os agentes leem)
.claude/settings.json           Liga agent teams + permissões seguras pré-aprovadas
.claude/agents/
  tech-lead.md                  Lead da sessão (orquestra)
  architect.md                  Desenho, contratos, ADRs
  backend.md                    APIs, regras, dados
  frontend.md                   UI, cliente, acessibilidade
  qa.md                         Testes e gate de qualidade
  project-manager.md            Escopo, critérios, riscos, status
.claude/skills/
  claude-boas-praticas/         Como usar Claude, Claude Code, skills, agentes, hooks, MCP
  kickoff/                      Comando /kickoff para montar o time
  tokens/                       Comando /tokens: resumo de consumo + abre o painel
docs/adr/0000-modelo.md         Modelo de registro de decisão
monitor/
  instalar.py                   Instala barra de status + hooks (com backup)
  statusline.py                 Barra de status com contexto, custo e limites
  painel.py                     Gera o painel visual e o resumo em texto
  painel_modelo.html            Layout do painel
  registrar_agente.py           Hook que anota qual agente é qual
  precos.json                   Tabela de preços (editável)
```

## Como instalar

1. Copie `CLAUDE.md`, `.claude/` e `docs/` para a raiz do seu projeto.
   - Se o projeto já tem um `CLAUDE.md`, cole o conteúdo deste no final do seu.
   - Ajuste no `CLAUDE.md` as pastas de cada dono (`src/server/`, `src/web/`…) para as do seu projeto.
   - Ajuste em `.claude/settings.json` os comandos de teste/lint (está com `npm`).
2. Abra o Claude Code na raiz do projeto como líder:
   ```bash
   claude --agent tech-lead
   ```
3. Monte o time:
   ```
   /kickoff criar a tela de cadastro de clientes com API e testes
   ```

Opcional: para ver cada agente num painel separado, rode dentro do `tmux` (ou iTerm2 com `it2`).
No modo padrão, use ↑/↓ e Enter no painel de agentes para ver e conversar com cada um; Ctrl+T mostra as tarefas.

## Monitoramento de tokens

Três camadas, da mais rápida para a mais completa:

| Onde | O que mostra | Como abrir |
|---|---|---|
| **Barra de status** (sempre visível no Claude Code) | agente · modelo · contexto em barra colorida · % de cache · custo da sessão · custo de hoje · limites de 5h e 7 dias, com alerta perto do limite | automático depois de instalar |
| **`/tokens`** (dentro do Claude Code) | resumo por agente (hoje e 7 dias) + 1–2 ações para economizar, e abre o painel | digite `/tokens` |
| **Painel HTML** | custo por dia empilhado por agente, ranking, tokens por tipo, sessões mais caras, por modelo e recomendações automáticas; filtros de período e projeto; modo claro/escuro | `python3 ~/.claude/monitor/painel.py --abrir` |

### Instalar (uma vez, vale para todos os projetos)
```bash
python3 monitor/instalar.py
```
Faz backup do seu `~/.claude/settings.json`, liga a barra de status e adiciona hooks leves que só registram
qual agente é qual (para o painel separar Tech Lead, Backend, QA…). Para desfazer: `python3 monitor/instalar.py --remover`.
Já tem uma barra de status que quer manter? Use `--sem-barra`.

### Painel ao vivo
```bash
python3 ~/.claude/monitor/painel.py --abrir --vivo 30   # regenera a cada 30 s; a página se atualiza sozinha
python3 ~/.claude/monitor/painel.py --demo --abrir      # vê como fica com dados de exemplo
```

### Leia com isto em mente
- Custos são **estimativas a preço de tabela** (`precos.json`, editável). Em planos Pro/Max/Team o que conta
  é o limite do plano — a barra mostra os percentuais de 5h e 7 dias, e `/usage` tem o detalhe oficial.
- O painel lê só as transcrições **desta máquina** (`~/.claude/projects`), guardadas por 30 dias por padrão.
- A separação por agente vale a partir da instalação; o que veio antes aparece como "Sessão principal" ou "subagente sem nome".
- Precisa de Python 3 (no Windows, troque `python3` por `python` no `/tokens` se necessário).

## Como eles "se escutam"

- **Mensagens diretas**: qualquer agente fala com qualquer outro pelo nome (`backend`, `qa`…).
- **Lista de tarefas compartilhada** com dependências: o backend termina, o QA é destravado.
- **Decisões em arquivo** (`docs/adr/`), para não se perderem quando a conversa acaba.
- **Regras de escalonamento**: discordaram 2 vezes → Tech Lead (técnico) ou Gerente de Projeto (escopo).
- **Memória por agente** (`memory: project`): cada um guarda aprendizados em `.claude/agent-memory/<papel>/`,
  versionável no git, e chega mais esperto na próxima sessão.

## Dicas de uso

- Nem toda tarefa precisa dos seis. Para um bug, peça só `backend` + `qa`.
- Times custam bem mais tokens que uma sessão só. Para coisas simples, use uma sessão normal
  (os mesmos agentes também funcionam como subagentes comuns).
- Agent teams ainda é **experimental**: `/resume` não traz teammates de volta e o status de tarefas às vezes atrasa.
- Quer garantir que nada é concluído sem testes? Adicione um hook `TaskCompleted`
  (veja `.claude/skills/claude-boas-praticas/referencia.md`).

Documentação oficial: https://code.claude.com/docs/en/agent-teams · https://code.claude.com/docs/en/sub-agents · https://code.claude.com/docs/en/skills
