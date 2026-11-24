"""Testes contra um PostgreSQL de verdade (TICKTICK_TEST_DATABASE_URL).

O banco de teste é zerado no começo da sessão (schema recriado e migrações aplicadas) e as tabelas
são esvaziadas antes de cada teste. Nunca aponte para o banco de produção.
"""

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from ticktick_api.app import criar_app
from ticktick_api.cli import criar_usuario, migrar
from ticktick_api.config import Config
from ticktick_api.db import criar_engine

URL = os.environ.get(
    "TICKTICK_TEST_DATABASE_URL", "postgresql+psycopg://ticktick:ticktick@127.0.0.1:5432/ticktick_teste"
)
SENHA = "senha-de-teste-123"


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    if not URL.rsplit("/", 1)[-1].endswith("teste"):
        pytest.exit(f"Por segurança, o banco de teste precisa terminar em 'teste': {URL}")
    eng = criar_engine(URL)
    with eng.begin() as c:
        c.execute(text("DROP SCHEMA public CASCADE"))
        c.execute(text("CREATE SCHEMA public"))
    migrar(URL)
    yield eng
    eng.dispose()


@pytest.fixture(autouse=True)
def banco_limpo(engine: Engine) -> None:
    with engine.begin() as c:
        c.execute(text("TRUNCATE usuarios, sessoes, registros CASCADE"))
        c.execute(text("ALTER SEQUENCE versao_registros RESTART"))


@pytest.fixture
def config() -> Config:
    return Config(database_url=URL, cookie_seguro=False)


@pytest.fixture
def app(config: Config, engine: Engine):
    return criar_app(config, engine)


def novo_cliente(app) -> TestClient:
    return TestClient(app, client=("10.0.0.1", 1234))


@pytest.fixture
def cliente(app) -> TestClient:
    return novo_cliente(app)


@pytest.fixture
def usuario() -> str:
    criar_usuario("eu@exemplo.com", SENHA, URL)
    return "eu@exemplo.com"


def entrar(cliente: TestClient, email: str = "eu@exemplo.com", senha: str = SENHA) -> TestClient:
    r = cliente.post("/api/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return cliente


@pytest.fixture
def logado(cliente: TestClient, usuario: str) -> TestClient:
    return entrar(cliente)
