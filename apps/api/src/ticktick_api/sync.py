"""Sincronização: push (lote de mudanças) e pull (o que mudou desde uma versão). Regras no ADR 0005."""

import json
import re
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .auth import Logado
from .db import sessao_db
from .modelos import Registro, versao_registros

# As mesmas tabelas do banco local do app (apps/web/src/db/banco.ts).
TABELAS = frozenset({"tarefas", "listas", "itensChecklist", "movs", "metas"})
NOME_CAMPO = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")
MAX_MUDANCAS = 500
MAX_CAMPOS = 100
MAX_BYTES = 64 * 1024

rotas = APIRouter(prefix="/api/sync", tags=["sync"])


class Mudanca(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tabela: str
    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    campos: dict[str, Any] = Field(min_length=1, max_length=MAX_CAMPOS)
    alterado_em: AwareDatetime

    @field_validator("tabela")
    @classmethod
    def _tabela_conhecida(cls, v: str) -> str:
        if v not in TABELAS:
            raise ValueError(f"tabela desconhecida; aceitas: {', '.join(sorted(TABELAS))}")
        return v

    @field_validator("campos")
    @classmethod
    def _campos_validos(cls, v: dict[str, Any]) -> dict[str, Any]:
        for nome in v:
            if not NOME_CAMPO.match(nome):
                raise ValueError(f"nome de campo inválido: {nome!r}")
            if nome == "id":
                raise ValueError("o id vem fora de 'campos'")
        if len(json.dumps(v, ensure_ascii=False).encode()) > MAX_BYTES:
            raise ValueError(f"campos passam de {MAX_BYTES // 1024} KB")
        return v


class PushEntrada(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mudancas: list[Mudanca] = Field(max_length=MAX_MUDANCAS)


class Resultado(BaseModel):
    tabela: str
    id: str
    aplicados: list[str]
    ignorados: list[str]
    server_version: int


class PushSaida(BaseModel):
    resultados: list[Resultado]
    versao: int


class RegistroSaida(BaseModel):
    tabela: str
    id: str
    dados: dict[str, Any]
    server_version: int


class PullSaida(BaseModel):
    registros: list[RegistroSaida]
    versao: int
    mais: bool


def _iso(momento: datetime) -> str:
    """ISO em UTC com microssegundos e largura fixa: compara certo como texto."""
    return momento.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


@rotas.post("/push", response_model=PushSaida)
def push(entrada: PushEntrada, usuario: Logado, db: Annotated[Session, Depends(sessao_db)]) -> PushSaida:
    # Pushes do mesmo usuário em fila: as versões dele são confirmadas na ordem em que são geradas,
    # então um pull nunca "pula" uma versão que ainda ia ser confirmada.
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:u))"), {"u": str(usuario.id)})
    agora = datetime.now(UTC)
    resultados: list[Resultado] = []

    for m in entrada.mudancas:
        quando = _iso(min(m.alterado_em, agora))  # relógio adiantado do aparelho conta como agora
        db.execute(
            insert(Registro)
            .values(
                usuario_id=usuario.id,
                tabela=m.tabela,
                id=m.id,
                dados={"id": m.id},
                relogios={},
                server_version=0,
            )
            .on_conflict_do_nothing()
        )
        reg = db.scalars(
            select(Registro)
            .where(Registro.usuario_id == usuario.id, Registro.tabela == m.tabela, Registro.id == m.id)
            .with_for_update()
        ).one()

        dados = dict(reg.dados)
        relogios = dict(reg.relogios)
        aplicados: list[str] = []
        ignorados: list[str] = []
        for campo, valor in m.campos.items():
            if quando > relogios.get(campo, ""):
                dados[campo] = valor
                relogios[campo] = quando
                aplicados.append(campo)
            else:
                ignorados.append(campo)

        if aplicados:
            reg.dados = dados
            reg.relogios = relogios
            reg.server_version = db.scalar(select(versao_registros.next_value()))
        resultados.append(
            Resultado(
                tabela=m.tabela,
                id=m.id,
                aplicados=aplicados,
                ignorados=ignorados,
                server_version=reg.server_version,
            )
        )

    db.flush()
    versao = db.scalar(
        select(func.coalesce(func.max(Registro.server_version), 0)).where(Registro.usuario_id == usuario.id)
    )
    return PushSaida(resultados=resultados, versao=versao or 0)


@rotas.get("/pull", response_model=PullSaida)
def pull(
    usuario: Logado,
    db: Annotated[Session, Depends(sessao_db)],
    since: Annotated[int, Query(ge=0)] = 0,
    limite: Annotated[int, Query(ge=1, le=1000)] = 500,
) -> PullSaida:
    linhas = db.scalars(
        select(Registro)
        .where(Registro.usuario_id == usuario.id, Registro.server_version > since)
        .order_by(Registro.server_version)
        .limit(limite + 1)
    ).all()
    mais = len(linhas) > limite
    linhas = linhas[:limite]
    return PullSaida(
        registros=[
            RegistroSaida(tabela=r.tabela, id=r.id, dados=r.dados, server_version=r.server_version)
            for r in linhas
        ],
        versao=linhas[-1].server_version if linhas else since,
        mais=mais,
    )
