"""Rotas de notificações (ADR 0008): chave pública, aparelhos inscritos, teste e adiar lembrete."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .auth import Logado
from .db import sessao_db
from .lembretes import adiar, fuso
from .modelos import PushAssinatura
from .push import chave_publica, enviar

rotas = APIRouter(prefix="/api", tags=["notificações"])
Db = Annotated[Session, Depends(sessao_db)]


class Chaves(BaseModel):
    p256dh: str = Field(min_length=10, max_length=255)
    auth: str = Field(min_length=10, max_length=255)


class Inscricao(BaseModel):
    model_config = ConfigDict(extra="ignore")  # o navegador manda também expirationTime
    endpoint: str = Field(pattern=r"^https://", max_length=2000)
    keys: Chaves
    fuso: str = Field(default="America/Sao_Paulo", max_length=64)
    aparelho: str = Field(default="", max_length=200)


class Remocao(BaseModel):
    endpoint: str = Field(max_length=2000)


class PedidoAdiar(BaseModel):
    tarefaId: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    minutos: int = Field(default=10, ge=1, le=24 * 60)


@rotas.get("/push/chave")
def chave(usuario: Logado, db: Db) -> dict[str, str]:
    return {"chave": chave_publica(db)}


@rotas.post("/push/assinaturas", status_code=status.HTTP_204_NO_CONTENT)
def inscrever(entrada: Inscricao, usuario: Logado, db: Db) -> None:
    db.execute(
        insert(PushAssinatura)
        .values(
            endpoint=entrada.endpoint,
            usuario_id=usuario.id,
            p256dh=entrada.keys.p256dh,
            auth=entrada.keys.auth,
            aparelho=entrada.aparelho,
        )
        .on_conflict_do_update(
            index_elements=[PushAssinatura.endpoint],
            set_={"usuario_id": usuario.id, "p256dh": entrada.keys.p256dh, "auth": entrada.keys.auth},
        )
    )
    # O fuso do aparelho vale para os lembretes (fuso inválido cai no padrão).
    usuario.fuso = fuso(entrada.fuso).key


@rotas.delete("/push/assinaturas", status_code=status.HTTP_204_NO_CONTENT)
def remover(entrada: Remocao, usuario: Logado, db: Db) -> None:
    db.execute(
        delete(PushAssinatura).where(
            PushAssinatura.endpoint == entrada.endpoint, PushAssinatura.usuario_id == usuario.id
        )
    )


@rotas.post("/push/teste")
def teste(request: Request, usuario: Logado, db: Db) -> dict[str, int]:
    r = enviar(
        db,
        usuario.id,
        {
            "tipo": "teste",
            "titulo": "TickTick",
            "corpo": "As notificações estão funcionando.",
            "tag": "teste",
        },
        request.app.state.config.vapid_contato,
        request.app.state.enviador_push,
    )
    return {"enviados": r.enviados, "removidos": r.removidos, "falhas": r.falhas}


@rotas.post("/lembretes/adiar")
def adiar_lembrete(entrada: PedidoAdiar, usuario: Logado, db: Db) -> dict[str, str]:
    quando = adiar(db, usuario.id, entrada.tarefaId, entrada.minutos, datetime.now(UTC))
    return {"quando": quando.isoformat()}
