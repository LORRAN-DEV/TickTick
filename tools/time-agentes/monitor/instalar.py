#!/usr/bin/env python3
"""Instala o monitor de tokens no seu Claude Code (vale para todos os projetos).

  python3 monitor/instalar.py              instala/atualiza
  python3 monitor/instalar.py --sem-barra  instala sem trocar a barra de status
  python3 monitor/instalar.py --remover    desfaz (mantém seus dados)

O que faz:
  1. Copia os scripts para ~/.claude/monitor/
  2. Em ~/.claude/settings.json (com backup antes):
     - liga a barra de status (statusLine)
     - adiciona hooks que registram qual agente é qual (SessionStart, SubagentStart,
       SubagentStop, TeammateIdle). Eles só gravam um arquivo local e nunca bloqueiam.
"""
import argparse
import datetime
import json
import os
import shutil
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude")
DESTINO = os.path.join(BASE, "monitor")
SETTINGS = os.path.join(BASE, "settings.json")
ARQUIVOS = ["statusline.py", "registrar_agente.py", "painel.py", "painel_modelo.html", "precos.json"]
EVENTOS = ["SessionStart", "SubagentStart", "SubagentStop", "TeammateIdle"]
MARCA = "registrar_agente.py"


def q(p):
    return f'"{p}"'


def ler_settings():
    if not os.path.exists(SETTINGS):
        return {}
    with open(SETTINGS, encoding="utf-8") as f:
        texto = f.read().strip()
    return json.loads(texto) if texto else {}


def gravar_settings(s):
    os.makedirs(BASE, exist_ok=True)
    if os.path.exists(SETTINGS):
        bkp = SETTINGS + ".bkp-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        shutil.copy2(SETTINGS, bkp)
        print(f"  backup: {bkp}")
    with open(SETTINGS, "w", encoding="utf-8") as f:
        json.dump(s, f, indent=2, ensure_ascii=False)
        f.write("\n")


def instalar(sem_barra):
    py = sys.executable or "python3"
    os.makedirs(DESTINO, exist_ok=True)
    for a in ARQUIVOS:
        alvo = os.path.join(DESTINO, a)
        if a == "precos.json" and os.path.exists(alvo):
            continue  # preserva preços que você editou
        shutil.copy2(os.path.join(AQUI, a), alvo)
    print(f"✓ scripts copiados para {DESTINO}")

    s = ler_settings()
    if not sem_barra:
        cmd = f"{q(py)} {q(os.path.join(DESTINO, 'statusline.py'))}"
        antiga = (s.get("statusLine") or {}).get("command")
        if antiga and "statusline.py" not in antiga:
            print(f"  aviso: sua barra de status anterior foi substituída ({antiga}). Ela está no backup.")
        s["statusLine"] = {"type": "command", "command": cmd, "padding": 0}
        print("✓ barra de status ligada")

    hooks = s.setdefault("hooks", {})
    cmd_hook = f"{q(py)} {q(os.path.join(DESTINO, 'registrar_agente.py'))}"
    for ev in EVENTOS:
        lista = hooks.setdefault(ev, [])
        ja = any(MARCA in h.get("command", "") for g in lista for h in g.get("hooks", []))
        if not ja:
            lista.append({"hooks": [{"type": "command", "command": cmd_hook, "timeout": 5}]})
    print(f"✓ hooks de registro em: {', '.join(EVENTOS)}")
    gravar_settings(s)
    print("\nPronto. Abra uma nova sessão do Claude Code para ver a barra.")
    print(f"Painel: {q(py)} {q(os.path.join(DESTINO, 'painel.py'))} --abrir")


def remover():
    s = ler_settings()
    if "statusline.py" in (s.get("statusLine") or {}).get("command", ""):
        del s["statusLine"]
    for ev in EVENTOS:
        grupos = s.get("hooks", {}).get(ev, [])
        grupos = [g for g in grupos if not any(MARCA in h.get("command", "") for h in g.get("hooks", []))]
        if grupos:
            s["hooks"][ev] = grupos
        elif "hooks" in s:
            s["hooks"].pop(ev, None)
    if s.get("hooks") == {}:
        del s["hooks"]
    gravar_settings(s)
    print(f"✓ removido do settings.json. Seus dados continuam em {DESTINO} (apague a pasta se quiser).")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--remover", action="store_true")
    ap.add_argument("--sem-barra", action="store_true")
    a = ap.parse_args()
    remover() if a.remover else instalar(a.sem_barra)
