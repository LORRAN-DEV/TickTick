---
name: tokens
description: Mostra o consumo de tokens e o custo estimado por agente do time e abre o painel visual. Use quando o humano digitar /tokens.
disable-model-invocation: true
---

Resumo atual (gerado agora pelo monitor):

!`python3 ~/.claude/monitor/painel.py --resumo --abrir 2>&1 || python ~/.claude/monitor/painel.py --resumo --abrir 2>&1`

Com base nesse resumo, responda em no máximo 6 linhas:
1. Quanto foi gasto hoje e nos últimos 7 dias, e quem lidera o consumo.
2. Uma ou duas ações concretas para reduzir custo (ex.: trocar `model:` de um agente, `/clear` entre tarefas,
   encerrar teammates ociosos, baixar `effort`), só se os números justificarem.
3. Lembre que o painel completo foi aberto no navegador.

Se o comando falhar porque o monitor não está instalado, diga para rodar `python3 tools/time-agentes/monitor/instalar.py` na raiz do repositório (instala na máquina do usuário, não no projeto).
