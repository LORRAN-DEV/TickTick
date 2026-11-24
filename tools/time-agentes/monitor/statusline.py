#!/usr/bin/env python3
"""Barra de status do Claude Code com foco em tokens e custo.

Recebe o JSON da sessão pela entrada padrão (stdin) e imprime 2 linhas:
  1) agente · modelo · esforço │ contexto [barra] % │ cache
  2) custo da sessão │ custo de hoje (todas as sessões) │ limite 5h │ limite 7d │ linhas

Também grava o custo de cada sessão em ~/.claude/monitor/sessoes.json
para somar o "hoje" sem precisar ler todas as transcrições.
"""
import datetime
import json
import os
import sys

DIR = os.path.join(os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude"), "monitor")
ESTADO = os.path.join(DIR, "sessoes.json")

# Cores ANSI
R = "\033[0m"
DIM = "\033[2m"
BOLD = "\033[1m"
VERDE = "\033[32m"
AMARELO = "\033[33m"
VERMELHO = "\033[31m"
CIANO = "\033[36m"
MAGENTA = "\033[35m"

SEP = f" {DIM}│{R} "


def g(d, *ks, default=None):
    for k in ks:
        if not isinstance(d, dict) or k not in d or d[k] is None:
            return default
        d = d[k]
    return d


def cor_pct(p, alerta=50, critico=80):
    if p is None:
        return DIM
    return VERDE if p < alerta else AMARELO if p < critico else VERMELHO


def barra(p, largura=10, alerta=50, critico=80):
    if p is None:
        return DIM + "░" * largura + R
    cheio = max(0, min(largura, round(p / 100 * largura)))
    return cor_pct(p, alerta, critico) + "█" * cheio + DIM + "░" * (largura - cheio) + R


def tk(n):
    if n is None:
        return "?"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1000:
        return f"{n / 1000:.0f}k"
    return str(int(n))


def usd(v):
    return f"US$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def registrar(d, custo):
    """Guarda o custo da sessão e devolve o total de hoje."""
    hoje = datetime.date.today().isoformat()
    try:
        with open(ESTADO, encoding="utf-8") as f:
            est = json.load(f)
    except Exception:
        est = {}
    sid = d.get("session_id") or "?"
    atual = est.get(sid, {})
    if custo is not None and (atual.get("custo") != custo or atual.get("dia") != hoje):
        # Se a sessão atravessou a meia-noite, conta só o que foi gasto hoje.
        base = atual.get("base", 0.0) if atual.get("dia") == hoje else atual.get("custo", 0.0)
        est[sid] = {
            "custo": custo,
            "base": base,
            "dia": hoje,
            "agente": g(d, "agent", "name", default=""),
            "modelo": g(d, "model", "display_name", default=""),
            "pasta": g(d, "workspace", "project_dir", default=d.get("cwd", "")),
        }
        limite = (datetime.date.today() - datetime.timedelta(days=40)).isoformat()
        est = {k: v for k, v in est.items() if v.get("dia", "") >= limite}
        try:
            os.makedirs(DIR, exist_ok=True)
            tmp = ESTADO + f".{os.getpid()}.tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(est, f)
            os.replace(tmp, ESTADO)
        except Exception:
            pass
    return sum(max(0.0, v.get("custo", 0) - v.get("base", 0)) for v in est.values() if v.get("dia") == hoje)


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("monitor: sem dados")
        return

    agente = g(d, "agent", "name")
    modelo = g(d, "model", "display_name", default="?")
    esforco = g(d, "effort", "level")
    ctx_pct = g(d, "context_window", "used_percentage")
    ctx_tam = g(d, "context_window", "context_window_size")
    ctx_tok = g(d, "context_window", "total_input_tokens")
    hit = g(d, "prompt_cache", "hit_ratio")
    custo = g(d, "cost", "total_cost_usd")
    mais = g(d, "cost", "total_lines_added", default=0)
    menos = g(d, "cost", "total_lines_removed", default=0)
    h5 = g(d, "rate_limits", "five_hour", "used_percentage")
    d7 = g(d, "rate_limits", "seven_day", "used_percentage")
    gasto = g(d, "rate_limits", "spend_limit", "used_percentage")

    # Linha 1
    quem = f"{BOLD}{MAGENTA}◆ {agente}{R} · " if agente else ""
    l1 = f"{quem}{CIANO}{modelo}{R}" + (f" {DIM}· {esforco}{R}" if esforco else "")
    ctx_txt = f"{ctx_pct:.0f}%" if isinstance(ctx_pct, (int, float)) else "--"
    detalhe = f" {DIM}({tk(ctx_tok)}/{tk(ctx_tam)}){R}" if ctx_tok and ctx_tam else ""
    l1 += SEP + f"contexto {barra(ctx_pct)} {cor_pct(ctx_pct)}{ctx_txt}{R}{detalhe}"
    if isinstance(ctx_pct, (int, float)) and ctx_pct >= 70:
        l1 += f" {AMARELO}→ /compact ou /clear{R}"
    if isinstance(hit, (int, float)):
        c = VERDE if hit >= 0.8 else AMARELO if hit >= 0.5 else VERMELHO
        l1 += SEP + f"cache {c}{hit * 100:.0f}%{R}"

    # Linha 2
    hoje = registrar(d, custo)
    l2 = f"sessão {BOLD}{usd(custo or 0)}{R}" + SEP + f"hoje {BOLD}{usd(hoje)}{R}"
    if h5 is not None:
        l2 += SEP + f"5h {barra(h5, 6, 60, 85)} {cor_pct(h5, 60, 85)}{h5:.0f}%{R}"
    if d7 is not None:
        l2 += SEP + f"7d {cor_pct(d7, 60, 85)}{d7:.0f}%{R}"
    if gasto is not None:
        l2 += SEP + f"créditos {cor_pct(gasto, 60, 85)}{gasto:.0f}%{R}"
    if mais or menos:
        l2 += SEP + f"{VERDE}+{mais}{R}/{VERMELHO}-{menos}{R}"
    if (h5 or 0) >= 85 or (d7 or 0) >= 85:
        l2 += f" {VERMELHO}⚠ perto do limite{R}"

    print(l1)
    print(l2)


if __name__ == "__main__":
    main()
