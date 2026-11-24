"""Linha de comando: `ticktick-api migrar | criar-usuario EMAIL | servir`."""

import argparse
import getpass
import sys
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .config import config_padrao
from .db import criar_engine
from .modelos import Usuario
from .seguranca import hash_senha

PASTA_API = Path(__file__).resolve().parents[2]


def migrar(url: str | None = None) -> None:
    """Aplica as migrações do Alembic até a última."""
    from alembic import command
    from alembic.config import Config as AlembicConfig

    cfg = AlembicConfig(str(PASTA_API / "alembic.ini"))
    cfg.set_main_option("script_location", str(PASTA_API / "migrations"))
    cfg.attributes["url"] = url or config_padrao().database_url
    command.upgrade(cfg, "head")


def criar_usuario(email: str, senha: str, url: str | None = None) -> None:
    email = email.strip().lower()
    if "@" not in email:
        raise SystemExit("E-mail inválido")
    if len(senha) < 10:
        raise SystemExit("A senha precisa de pelo menos 10 caracteres")
    engine = criar_engine(url or config_padrao().database_url)
    with Session(engine) as db:
        if db.scalar(select(Usuario).where(Usuario.email == email)):
            raise SystemExit(f"Já existe usuário com o e-mail {email}")
        db.add(Usuario(email=email, senha_hash=hash_senha(senha)))
        db.commit()


def preparar_teste(email: str, senha: str, url: str | None = None) -> None:
    """Zera um banco de TESTE (nome terminando em 'teste' ou 'e2e'), migra e cria o usuário."""
    url = url or config_padrao().database_url
    nome = url.rsplit("/", 1)[-1].split("?")[0]
    if not (nome.endswith("teste") or nome.endswith("e2e")):
        raise SystemExit(
            f"Recusado: '{nome}' não parece um banco de teste (precisa terminar em 'teste' ou 'e2e')"
        )
    engine = criar_engine(url)
    with engine.begin() as c:
        c.execute(text("DROP SCHEMA public CASCADE"))
        c.execute(text("CREATE SCHEMA public"))
    engine.dispose()
    migrar(url)
    criar_usuario(email, senha, url)


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="ticktick-api", description="API do TickTick")
    sub = p.add_subparsers(dest="comando", required=True)
    sub.add_parser("migrar", help="cria/atualiza as tabelas no banco")
    c = sub.add_parser("criar-usuario", help="cria o usuário (a senha é pedida no terminal)")
    c.add_argument("email")
    c.add_argument("--senha-stdin", action="store_true", help="lê a senha da entrada padrão (para scripts)")
    t = sub.add_parser("preparar-teste", help="zera um banco de teste e cria o usuário (testes e2e)")
    t.add_argument("email")
    t.add_argument("--senha-stdin", action="store_true", required=True)
    s = sub.add_parser("servir", help="sobe a API com uvicorn")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--porta", type=int, default=8000)
    a = p.parse_args(argv)

    if a.comando == "migrar":
        migrar()
        print("Banco atualizado.")
    elif a.comando == "criar-usuario":
        if a.senha_stdin:
            senha = sys.stdin.readline().rstrip("\n")
        else:
            senha = getpass.getpass("Senha: ")
            if getpass.getpass("Repita a senha: ") != senha:
                raise SystemExit("As senhas não conferem")
        criar_usuario(a.email, senha)
        print(f"Usuário {a.email.strip().lower()} criado.")
    elif a.comando == "preparar-teste":
        preparar_teste(a.email, sys.stdin.readline().rstrip("\n"))
        print(f"Banco de teste pronto, usuário {a.email.strip().lower()}.")
    elif a.comando == "servir":
        import uvicorn

        from .app import criar_app

        # Atrás do Caddy, o IP do cliente (limite de login) vem do X-Forwarded-For, mas só se o proxy for
        # confiável: TICKTICK_PROXIES_CONFIAVEIS (no Docker, "*": a API só é alcançável pela rede interna).
        uvicorn.run(
            criar_app(),
            host=a.host,
            port=a.porta,
            proxy_headers=True,
            forwarded_allow_ips=config_padrao().proxies_confiaveis,
        )
