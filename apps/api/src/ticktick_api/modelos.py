"""Tabelas do banco (ADR 0005). Mudou algo aqui? Crie uma migração do Alembic em migrations/versions/."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Sequence, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Sessao(Base):
    """Sessão de login. O token só existe no cookie do navegador; aqui fica o hash SHA-256 dele."""

    __tablename__ = "sessoes"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


# Sequência global: cada mudança aceita no sync ganha o próximo número (plano: server_version).
versao_registros = Sequence("versao_registros", metadata=Base.metadata)


class Registro(Base):
    """Um registro do app (tarefa, lista, item de checklist, movimentação, meta) como documento JSONB."""

    __tablename__ = "registros"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True
    )
    tabela: Mapped[str] = mapped_column(String(40), primary_key=True)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    dados: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # Para cada campo, quando foi alterado (ISO 8601 em UTC): base do "vence a edição mais recente".
    relogios: Mapped[dict[str, str]] = mapped_column(JSONB)
    server_version: Mapped[int] = mapped_column(BigInteger)

    __table_args__ = (Index("ix_registros_usuario_versao", "usuario_id", "server_version"),)
