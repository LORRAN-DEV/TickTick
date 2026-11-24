---
name: claude-boas-praticas
description: Guia de quando e como usar recursos do Claude e do Claude Code (subagentes, agent teams, skills, hooks, MCP, memória, worktrees, modelos e esforço). Use ao decidir como delegar trabalho, criar ou ajustar agentes/skills/hooks, ou otimizar custo e qualidade do time.
user-invocable: false
---

# Boas práticas: Claude, Claude Code, skills e agentes

Referência detalhada (campos de frontmatter, hooks, comandos): [referencia.md](referencia.md).

## Escolha a ferramenta certa (do mais leve para o mais pesado)

| Situação | Use |
|---|---|
| Tarefa pequena, sequencial, mesmo arquivo | Uma sessão só. Não delegue. |
| Pesquisa/verificação focada em que só o resultado importa | **Subagente** (volta só o resumo; economiza contexto) |
| Procedimento repetível ("como fazemos X aqui") | **Skill** em `.claude/skills/<nome>/SKILL.md` |
| Papéis que precisam discutir, desafiar e coordenar entre si | **Agent team** (teammates com mensagens + lista de tarefas) |
| Regra que **tem** que acontecer sempre (lint, bloquear comando, gate) | **Hook** — determinístico, não depende do modelo lembrar |
| Acesso a sistema externo (GitHub, Jira, banco, Drive) | **MCP server** |
| Trabalho paralelo no mesmo repo sem conflito de arquivos | **Worktree** (`isolation: worktree`) |

Agent teams custam bem mais tokens (cada teammate é uma instância completa). Vale para pesquisa,
revisão com vários olhares, features que cruzam camadas e debug com hipóteses concorrentes.
Não vale para tarefas sequenciais ou edições no mesmo arquivo.

## Agent teams — o que funciona
- **3–5 teammates** na maioria dos casos; 5–6 tarefas por teammate.
- **Dê contexto no prompt de criação**: teammates carregam CLAUDE.md, skills e MCP, mas **não** o histórico do lead.
- **Nomeie os teammates** de forma previsível para que possam se endereçar por SendMessage.
- **Um dono por arquivo.** Duas edições no mesmo arquivo = sobrescrita.
- **Comece por pesquisa e revisão** antes de implementação paralela.
- **Debate adversarial** ajuda em debug: peça aos teammates para tentar refutar as hipóteses uns dos outros.
- Tarefas arriscadas: lead em **plan mode** → teammate planeja antes de editar.
- O lead às vezes implementa no lugar dos teammates ou encerra cedo: peça para esperar/continuar.
- Limitações: um time por sessão, sem times aninhados, `/resume` não restaura teammates in-process,
  status de tarefa às vezes atrasa.

## Subagentes — o que funciona
- `description` curta e específica decide a delegação; "use proactively" incentiva uso automático.
- Detalhes no corpo, não na description (o corpo só carrega quando o agente roda).
- **Menor privilégio**: `tools` como allowlist para papéis de leitura/revisão.
- **Modelo por tarefa**: `haiku`/`sonnet` para busca e rotina; `opus` para desenho e decisões difíceis.
- `memory: project` para o agente manter notas versionáveis entre sessões.
- Subagentes não criam subagentes.

## Skills — o que funciona
- Description escrita para **disparar**: caso de uso primeiro, com as frases que as pessoas falam.
- `SKILL.md` com menos de 500 linhas; detalhes em arquivos de apoio linkados (carregam só se preciso).
- Diga **o que fazer**, não a história por trás; o conteúdo fica no contexto pelo resto da sessão.
- `disable-model-invocation: true` para ações com efeito colateral (deploy, publicar) — só o humano dispara.
- `user-invocable: false` para conhecimento de fundo (como esta skill).
- `context: fork` só para skills com instruções acionáveis.
- Teste com e sem a skill em sessões novas antes de confiar (o plugin `skill-creator` automatiza isso).

## Prompting que rende mais
- Seja específico: objetivo, contexto, restrições, formato de saída e critério de "pronto".
- Dê exemplos (bons e ruins) quando o formato importa.
- Peça para **verificar** (rodar testes, abrir o arquivo) antes de declarar concluído.
- Para trabalho grande: planeje primeiro (plan mode), depois execute em passos pequenos.
- CLAUDE.md curto e factual: comandos, convenções, onde as coisas ficam. Não é lugar para ensaio.

## Custo e qualidade
- Esforço (`effort`): `low`/`medium` para rotina, `high`+ para arquitetura, debug difícil e revisão crítica.
- Pré-aprove comandos seguros em `permissions.allow` para reduzir prompts que sobem dos teammates ao lead.
- Encerre teammates ociosos; tokens escalam com o número de instâncias ativas.

## Novidades e verificação
Recursos mudam rápido (agent teams ainda é experimental). Antes de afirmar algo sobre um recurso,
confira a documentação oficial: https://code.claude.com/docs (índice em https://code.claude.com/docs/llms.txt).
