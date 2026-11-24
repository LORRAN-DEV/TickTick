#!/usr/bin/env python3
"""Hook do Claude Code: registra qual agente é dono de cada transcrição.

Ligado aos eventos SessionStart, SubagentStart, SubagentStop e TeammateIdle.
Grava uma linha por evento em ~/.claude/monitor/agentes.jsonl com
session_id, agent_id, agent_type e caminhos de transcrição. O painel usa
isso para atribuir tokens ao papel certo (tech-lead, backend, qa...).
Nunca bloqueia o Claude: qualquer erro é ignorado e sai com código 0.
"""
import datetime
import json
import os
import sys

DIR = os.path.join(os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude"), "monitor")
CAMPOS_GRANDES = {"last_assistant_message", "prompt", "tool_input", "tool_response", "message"}


def main():
    try:
        d = json.load(sys.stdin)
        reg = {k: v for k, v in d.items() if k not in CAMPOS_GRANDES and isinstance(v, (str, int, float, bool))}
        if not any(k in reg for k in ("agent_type", "agent_id", "teammate_name", "agent_name")):
            return  # sessão comum sem agente nomeado: nada a registrar
        reg["ts"] = datetime.datetime.now().isoformat(timespec="seconds")
        os.makedirs(DIR, exist_ok=True)
        with open(os.path.join(DIR, "agentes.jsonl"), "a", encoding="utf-8") as f:
            f.write(json.dumps(reg, ensure_ascii=False) + "\n")
    except Exception:
        pass


if __name__ == "__main__":
    main()
    sys.exit(0)
