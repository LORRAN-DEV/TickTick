---
name: kickoff
description: Monta o time de agentes (architect, backend, frontend, qa, project-manager) para um objetivo. Use quando o humano digitar /kickoff seguido do objetivo.
argument-hint: "[objetivo da sessão]"
disable-model-invocation: true
---

Objetivo desta sessão: $ARGUMENTS

1. Leia `CLAUDE.md` e, se existirem, `docs/project/` e `docs/adr/`.
2. Decida quais papéis o objetivo realmente precisa (nem sempre são os cinco) e diga ao humano em 2–3 linhas
   quem vai entrar e por quê. Se o objetivo estiver ambíguo, faça **uma** pergunta antes de seguir.
3. Crie um agent team. Para cada papel escolhido, crie um teammate **com o nome exato do papel**
   usando a definição de agente de mesmo nome (`architect`, `backend`, `frontend`, `qa`, `project-manager`).
   No prompt de cada um inclua: objetivo, critérios de aceite conhecidos, pastas que ele é dono,
   com quem deve conversar primeiro e o que entregar.
4. Comece pelo `project-manager` (escopo e critérios) e `architect` (desenho e contratos) em paralelo;
   `qa` acompanha desde já. Libere `backend`/`frontend` quando o contrato existir.
5. Monte a lista de tarefas com dependências seguindo o "Fluxo padrão" do CLAUDE.md.
6. Acompanhe, destrave, e só encerre depois do gate do `qa` e do status do `project-manager`.
