"""Conexão com o PostgreSQL."""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker


def criar_engine(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True)


def sessao_db(request: Request) -> Iterator[Session]:
    """Dependência do FastAPI: uma sessão por requisição; confirma no fim, desfaz se der erro."""
    fabrica: sessionmaker[Session] = request.app.state.sessoes
    with fabrica() as db:
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
