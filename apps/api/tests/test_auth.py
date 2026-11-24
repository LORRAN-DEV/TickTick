"""Objetivo 7, critérios 1 a 3: usuário, login, logout e limite de tentativas."""

import io
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text, update
from sqlalchemy.orm import Session

from ticktick_api.cli import criar_usuario, main
from ticktick_api.modelos import Sessao

from .conftest import SENHA, URL, entrar


def test_1_criar_usuario_guarda_so_o_hash_argon2(engine, usuario):
    with engine.connect() as c:
        email, senha_hash = c.execute(text("SELECT email, senha_hash FROM usuarios")).one()
    assert email == "eu@exemplo.com"
    assert senha_hash.startswith("$argon2id$")
    assert SENHA not in senha_hash


def test_1_criar_usuario_recusa_repetido_e_senha_curta(usuario):
    with pytest.raises(SystemExit, match="Já existe"):
        criar_usuario("EU@exemplo.com ", "outra-senha-longa", URL)
    with pytest.raises(SystemExit, match="10 caracteres"):
        criar_usuario("outro@exemplo.com", "curta", URL)


def test_1_comando_criar_usuario_com_senha_pela_entrada(monkeypatch, engine):
    monkeypatch.setenv("TICKTICK_DATABASE_URL", URL)
    from ticktick_api.config import config_padrao

    config_padrao.cache_clear()
    monkeypatch.setattr("sys.stdin", io.StringIO("uma-senha-boa-123\n"))
    main(["criar-usuario", "Script@Exemplo.com", "--senha-stdin"])
    config_padrao.cache_clear()
    with engine.connect() as c:
        assert c.execute(text("SELECT email FROM usuarios")).scalar_one() == "script@exemplo.com"


def test_2_login_devolve_cookie_httponly(cliente, usuario):
    r = cliente.post("/api/auth/login", json={"email": " EU@exemplo.com", "senha": SENHA})
    assert r.status_code == 200
    assert r.json() == {"email": "eu@exemplo.com"}
    cookie = r.headers["set-cookie"].lower()
    assert "ticktick_sessao=" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert cliente.get("/api/auth/eu").json() == {"email": "eu@exemplo.com"}


def test_2_login_errado_nao_diz_o_que_errou(cliente, usuario):
    senha_errada = cliente.post("/api/auth/login", json={"email": "eu@exemplo.com", "senha": "errada"})
    email_errado = cliente.post("/api/auth/login", json={"email": "nao@existe.com", "senha": SENHA})
    assert senha_errada.status_code == email_errado.status_code == 401
    assert senha_errada.json() == email_errado.json()
    assert "set-cookie" not in senha_errada.headers


def test_2_cinco_erros_em_um_minuto_bloqueiam_com_429(cliente, usuario):
    for _ in range(5):
        assert (
            cliente.post("/api/auth/login", json={"email": "eu@exemplo.com", "senha": "x"}).status_code == 401
        )
    r = cliente.post("/api/auth/login", json={"email": "eu@exemplo.com", "senha": SENHA})
    assert r.status_code == 429


def test_2_cookie_seguro_em_producao(app, cliente, usuario):
    app.state.config.cookie_seguro = True
    r = cliente.post("/api/auth/login", json={"email": "eu@exemplo.com", "senha": SENHA})
    assert "secure" in r.headers["set-cookie"].lower()


def test_3_sem_sessao_e_401(cliente):
    assert cliente.get("/api/sync/pull").status_code == 401
    assert cliente.post("/api/sync/push", json={"mudancas": []}).status_code == 401
    assert cliente.get("/api/auth/eu").status_code == 401
    cliente.cookies.set("ticktick_sessao", "inventado")
    assert cliente.get("/api/sync/pull").status_code == 401


def test_3_logout_invalida_a_sessao_no_servidor(logado):
    token = logado.cookies.get("ticktick_sessao")
    assert logado.post("/api/auth/logout").status_code == 204
    logado.cookies.set("ticktick_sessao", token)  # mesmo que alguém tenha guardado o cookie
    assert logado.get("/api/sync/pull").status_code == 401


def test_3_sessao_vencida_e_401(engine, logado):
    with Session(engine) as db:
        db.execute(update(Sessao).values(expira_em=datetime.now(UTC) - timedelta(seconds=1)))
        db.commit()
    assert logado.get("/api/sync/pull").status_code == 401


def test_saude(cliente):
    assert cliente.get("/api/saude").json() == {"status": "ok"}


def test_entrar_de_novo_funciona_depois_do_logout(logado):
    logado.post("/api/auth/logout")
    entrar(logado)
    assert logado.get("/api/auth/eu").status_code == 200
