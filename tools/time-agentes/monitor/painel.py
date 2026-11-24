#!/usr/bin/env python3
"""Painel de consumo de tokens do Claude Code, por agente do time.

Lê as transcrições locais (~/.claude/projects/**.jsonl, inclusive as de
subagentes/teammates), soma os tokens de cada resposta, estima o custo pela
tabela de preços (precos.json) e gera um painel HTML com gráficos.

Uso:
  python3 painel.py                 gera o painel e mostra o caminho
  python3 painel.py --abrir         gera e abre no navegador
  python3 painel.py --resumo        imprime um resumo no terminal
  python3 painel.py --vivo 30       regenera a cada 30 s (a página se atualiza sozinha)
  python3 painel.py --dias 30       período analisado (padrão 30)
  python3 painel.py --demo          gera com dados fictícios, para ver como fica

Os custos são ESTIMATIVAS a preço de tabela. Em planos Pro/Max/Team o que vale
é o limite do plano (veja /usage); na API, a fatura do Console.
"""
import argparse
import datetime as dt
import glob
import json
import os
import random
import sys
import time
import webbrowser

BASE = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude")
DIR = os.path.join(BASE, "monitor")
AQUI = os.path.dirname(os.path.abspath(__file__))

EQUIPE = ["tech-lead", "architect", "backend", "frontend", "qa", "project-manager"]
GRUPOS = EQUIPE + ["principal", "outros"]
ROTULOS = {
    "tech-lead": "Tech Lead", "architect": "Architect", "backend": "Backend",
    "frontend": "Frontend", "qa": "QA", "project-manager": "Gerente de Projeto",
    "principal": "Sessão principal", "outros": "Outros subagentes",
}
CHAVES_AGENTE = ("agentType", "agent_type", "agentName", "agent_name", "teammateName",
                 "teammate_name", "agentSetting", "subagentType", "subagent_type")


# ---------------------------------------------------------------- preços
def carregar_precos():
    for p in (os.path.join(AQUI, "precos.json"), os.path.join(DIR, "precos.json")):
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                return json.load(f)["modelos"]
    return {}


def custo(precos, modelo, inp, out, c5, c1, cr):
    m = (modelo or "").lower()
    for chave, p in precos.items():
        if chave in m:
            if "acima_100k" in p and inp + c5 + c1 + cr > 100_000:
                p = p["acima_100k"]
            return (inp * p["entrada"] + out * p["saida"] + c5 * p["cache_5m"]
                    + c1 * p["cache_1h"] + cr * p["cache_leitura"]) / 1_000_000, True
    return 0.0, False


# ---------------------------------------------------------------- quem é quem
def carregar_mapa():
    por_id, por_transcricao = {}, {}
    try:
        with open(os.path.join(DIR, "agentes.jsonl"), encoding="utf-8") as f:
            for linha in f:
                try:
                    r = json.loads(linha)
                except Exception:
                    continue
                tipo = r.get("agent_type") or r.get("teammate_name") or r.get("agent_name")
                if not tipo:
                    continue
                if r.get("agent_id"):
                    por_id[str(r["agent_id"])] = tipo
                    if r.get("agent_transcript_path"):
                        por_transcricao[os.path.normpath(r["agent_transcript_path"])] = tipo
                elif r.get("transcript_path"):
                    # Sessão iniciada com --agent (ex.: tech-lead) ou teammate em painel separado
                    por_transcricao[os.path.normpath(r["transcript_path"])] = tipo
    except FileNotFoundError:
        pass
    return por_id, por_transcricao


def grupo_de(rotulo):
    r = (rotulo or "").strip().lower()
    if r in EQUIPE:
        return r
    if r in ("", "principal"):
        return "principal"
    return "outros"


def rotulo_arquivo(caminho, por_id, por_transcricao):
    norm = os.path.normpath(caminho)
    if norm in por_transcricao:
        return por_transcricao[norm]
    nome = os.path.basename(caminho)[:-len(".jsonl")]
    if os.sep + "subagents" + os.sep in norm:
        aid = nome[len("agent-"):] if nome.startswith("agent-") else nome
        if aid in por_id:
            return por_id[aid]
        for k, v in por_id.items():
            if k and k in nome:
                return v
        meta = caminho[:-len(".jsonl")] + ".meta.json"
        try:
            with open(meta, encoding="utf-8") as f:
                m = json.load(f)
            for k in CHAVES_AGENTE + ("name", "type"):
                if isinstance(m.get(k), str) and m[k]:
                    return m[k]
        except Exception:
            pass
        return None  # decide pelas linhas; senão "subagente"
    return None


# ---------------------------------------------------------------- leitura
def dia_local(ts):
    try:
        t = dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return t.astimezone().date().isoformat()
    except Exception:
        return None


def ler_transcricoes(dias, precos):
    por_id, por_transcricao = carregar_mapa()
    inicio = (dt.date.today() - dt.timedelta(days=dias - 1)).isoformat()
    limite_mtime = time.time() - (dias + 2) * 86400
    arquivos = glob.glob(os.path.join(BASE, "projects", "**", "*.jsonl"), recursive=True)
    vistos = {}       # message.id -> chave agregada (para não contar 2x)
    agregado = {}     # (dia, agente, modelo, sessao, projeto) -> [inp,out,c5,c1,cr,custo,msgs]
    sem_preco = set()

    for arq in arquivos:
        if ".orphaned-" in arq or ".superseded-" in arq:
            continue
        try:
            if os.path.getmtime(arq) < limite_mtime:
                continue
        except OSError:
            continue
        sub = os.sep + "subagents" + os.sep in os.path.normpath(arq)
        rotulo = rotulo_arquivo(arq, por_id, por_transcricao)
        projeto, sessao = None, None
        respostas = []
        try:
            with open(arq, encoding="utf-8", errors="replace") as f:
                for linha in f:
                    if '"usage"' not in linha and rotulo is not None and projeto is not None:
                        continue
                    try:
                        d = json.loads(linha)
                    except Exception:
                        continue
                    if not isinstance(d, dict):
                        continue
                    if projeto is None and d.get("cwd"):
                        projeto = os.path.basename(d["cwd"].rstrip("/\\")) or d["cwd"]
                    if sessao is None and d.get("sessionId"):
                        sessao = d["sessionId"]
                    if rotulo is None:
                        for k in CHAVES_AGENTE:
                            if isinstance(d.get(k), str) and d[k]:
                                rotulo = d[k]
                                break
                    msg = d.get("message")
                    if d.get("type") != "assistant" or not isinstance(msg, dict):
                        continue
                    u = msg.get("usage")
                    if not isinstance(u, dict) or msg.get("model") in (None, "<synthetic>"):
                        continue
                    dia = dia_local(d.get("timestamp", ""))
                    if not dia or dia < inicio:
                        continue
                    respostas.append((msg.get("id") or d.get("uuid"), dia, msg["model"], u))
        except OSError:
            continue

        if rotulo is None:
            rotulo = "subagente sem nome" if sub else "principal"
        if projeto is None:
            projeto = os.path.basename(os.path.dirname(arq)).lstrip("-") or "?"
        sessao = (sessao or os.path.basename(arq))[:8]

        for mid, dia, modelo, u in respostas:
            inp = int(u.get("input_tokens") or 0)
            out = int(u.get("output_tokens") or 0)
            cr = int(u.get("cache_read_input_tokens") or 0)
            cw = int(u.get("cache_creation_input_tokens") or 0)
            cc = u.get("cache_creation") if isinstance(u.get("cache_creation"), dict) else {}
            c1 = int(cc.get("ephemeral_1h_input_tokens") or 0)
            c5 = max(0, cw - c1)
            if inp + out + cw + cr == 0:
                continue
            valor, ok = custo(precos, modelo, inp, out, c5, c1, cr)
            if not ok:
                sem_preco.add(modelo)
            chave = (dia, rotulo, modelo, sessao, projeto)
            if mid and mid in vistos:
                # A mesma resposta pode aparecer em várias linhas (streaming): fica a última
                antiga_chave, antigo = vistos[mid]
                ag = agregado[antiga_chave]
                for i, v in enumerate(antigo):
                    ag[i] -= v
                ag[6] -= 1
            novo = [inp, out, c5, c1, cr, valor]
            ag = agregado.setdefault(chave, [0, 0, 0, 0, 0, 0.0, 0])
            for i, v in enumerate(novo):
                ag[i] += v
            ag[6] += 1
            if mid:
                vistos[mid] = (chave, novo)

    linhas = []
    for (dia, rot, modelo, sessao, projeto), v in agregado.items():
        if v[6] <= 0:
            continue
        linhas.append([dia, rot, grupo_de(rot), modelo, sessao, projeto,
                       v[0], v[1], v[2] + v[3], v[4], round(v[5], 6), v[6]])
    return linhas, sorted(sem_preco)


# ---------------------------------------------------------------- demo
def dados_demo(dias, precos):
    random.seed(7)
    perfis = {
        "tech-lead": ("claude-opus-5-5", 1.0), "architect": ("claude-opus-5-5", 0.7),
        "backend": ("claude-sonnet-5-5", 1.3), "frontend": ("claude-opus-5-5", 1.1),
        "qa": ("claude-sonnet-5-5", 0.8), "project-manager": ("claude-sonnet-5-5", 0.35),
        "Explore": ("claude-haiku-5-5", 0.5),
    }
    linhas = []
    hoje = dt.date.today()
    for i in range(dias):
        dia = hoje - dt.timedelta(days=i)
        if dia.weekday() >= 5 and random.random() < 0.7:
            continue
        sessao = f"{random.getrandbits(32):08x}"
        projeto = random.choice(["loja-online", "app-cadastro", "loja-online"])
        intens = random.uniform(0.4, 1.6)
        for ag, (modelo, peso) in perfis.items():
            if random.random() < 0.15:
                continue
            msgs = max(1, int(random.gauss(40, 12) * peso * intens))
            inp = msgs * random.randint(200, 900)
            out = msgs * random.randint(400, 1800)
            c5 = msgs * random.randint(1500, 6000)
            cr = msgs * random.randint(25000, 70000) * (0.12 if ag == "qa" else 1)
            cr = int(cr)
            v, _ = custo(precos, modelo, inp, out, c5, 0, cr)
            linhas.append([dia.isoformat(), ag, grupo_de(ag), modelo, sessao, projeto,
                           inp, out, c5, cr, round(v, 6), msgs])
    return linhas


# ---------------------------------------------------------------- saídas
def brl(v):
    return f"US$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def tk(n):
    return f"{n / 1e6:.1f}M" if n >= 1e6 else f"{n / 1e3:.0f}k" if n >= 1e3 else str(int(n))


def resumo(linhas, dias):
    hoje = dt.date.today().isoformat()
    sete = (dt.date.today() - dt.timedelta(days=6)).isoformat()
    tot = {}
    for l in linhas:
        a = tot.setdefault(l[1], [0.0, 0.0, 0, 0])
        if l[0] == hoje:
            a[0] += l[10]
        if l[0] >= sete:
            a[1] += l[10]
            a[2] += l[6] + l[7] + l[8] + l[9]
            a[3] += l[11]
    total7 = sum(v[1] for v in tot.values()) or 1
    print(f"Consumo de tokens — custo estimado a preço de tabela (até {hoje})\n")
    print(f"{'Agente':<20}{'Hoje':>12}{'7 dias':>12}{'% 7d':>7}{'Tokens 7d':>11}{'Respostas':>11}")
    print("-" * 73)
    for ag, v in sorted(tot.items(), key=lambda x: -x[1][1]):
        if v[1] == 0 and v[0] == 0:
            continue
        print(f"{ROTULOS.get(ag, ag):<20}{brl(v[0]):>12}{brl(v[1]):>12}{v[1] / total7 * 100:>6.0f}%{tk(v[2]):>11}{v[3]:>11}")
    print("-" * 73)
    print(f"{'TOTAL':<20}{brl(sum(v[0] for v in tot.values())):>12}{brl(sum(v[1] for v in tot.values())):>12}")
    inp = sum(l[6] + l[8] for l in linhas if l[0] >= sete)
    cr = sum(l[9] for l in linhas if l[0] >= sete)
    if inp + cr:
        print(f"\nCache: {cr / (inp + cr) * 100:.0f}% da entrada veio do cache nos últimos 7 dias.")


def gerar_html(linhas, dias, sem_preco, demo, vivo):
    with open(os.path.join(AQUI, "painel_modelo.html"), encoding="utf-8") as f:
        modelo = f.read()
    dados = {
        "gerado": dt.datetime.now().strftime("%d/%m/%Y %H:%M"),
        "hoje": dt.date.today().isoformat(),
        "dias": dias,
        "grupos": GRUPOS,
        "rotulos": ROTULOS,
        "linhas": linhas,
        "semPreco": sem_preco,
        "demo": demo,
    }
    html = modelo.replace("/*__DADOS__*/null", json.dumps(dados, ensure_ascii=False))
    refresh = f'<meta http-equiv="refresh" content="{vivo}">' if vivo else ""
    return html.replace("<!--__REFRESH__-->", refresh)


def main():
    ap = argparse.ArgumentParser(description="Painel de tokens por agente do Claude Code")
    ap.add_argument("--dias", type=int, default=30)
    ap.add_argument("--saida", default=os.path.join(DIR, "painel.html"))
    ap.add_argument("--abrir", action="store_true")
    ap.add_argument("--resumo", action="store_true")
    ap.add_argument("--vivo", type=int, default=0, metavar="SEGUNDOS")
    ap.add_argument("--demo", action="store_true")
    a = ap.parse_args()

    precos = carregar_precos()
    primeira = True
    while True:
        if a.demo:
            linhas, sem_preco = dados_demo(a.dias, precos), []
        else:
            linhas, sem_preco = ler_transcricoes(a.dias, precos)
        os.makedirs(os.path.dirname(os.path.abspath(a.saida)), exist_ok=True)
        with open(a.saida, "w", encoding="utf-8") as f:
            f.write(gerar_html(linhas, a.dias, sem_preco, a.demo, a.vivo))
        if primeira:
            if a.resumo:
                resumo(linhas, a.dias)
                print()
            print(f"Painel: {os.path.abspath(a.saida)}")
            if sem_preco:
                print(f"Aviso: sem preço para {', '.join(sem_preco)} — edite precos.json.")
            if a.abrir:
                webbrowser.open("file://" + os.path.abspath(a.saida))
            primeira = False
        if not a.vivo:
            break
        time.sleep(a.vivo)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
