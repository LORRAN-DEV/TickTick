"""Montagem do app FastAPI."""

from fastapi import FastAPI
from sqlalchemy import Engine
from sqlalchemy.orm import sessionmaker

from . import auth, sync
from .config import Config, config_padrao
from .db import criar_engine
from .seguranca import LimiteDeTentativas


def criar_app(config: Config | None = None, engine: Engine | None = None) -> FastAPI:
    config = config or config_padrao()
    engine = engine or criar_engine(config.database_url)

    app = FastAPI(
        title="TickTick API",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.state.config = config
    app.state.sessoes = sessionmaker(engine, expire_on_commit=False)
    app.state.limite_login = LimiteDeTentativas(config.login_max_falhas, config.login_janela_segundos)

    app.include_router(auth.rotas)
    app.include_router(sync.rotas)

    @app.get("/api/saude", tags=["saúde"])
    def saude() -> dict[str, str]:
        return {"status": "ok"}

    return app
