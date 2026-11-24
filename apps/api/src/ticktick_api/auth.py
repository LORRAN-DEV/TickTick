"""Login com cookie de sessão (ADR 0005). Usuário único, criado pelo comando `criar-usuario`."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import Config
from .db import sessao_db
from .modelos import Sessao, Usuario
from .seguranca import LimiteDeTentativas, conferir_senha, hash_token, novo_token

COOKIE = "ticktick_sessao"

rotas = APIRouter(prefix="/api/auth", tags=["login"])


class LoginEntrada(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    senha: str = Field(min_length=1, max_length=1024)


class EuSaida(BaseModel):
    email: str


def _config(request: Request) -> Config:
    return request.app.state.config


def usuario_atual(request: Request, db: Annotated[Session, Depends(sessao_db)]) -> Usuario:
    """Dependência: o usuário da sessão do cookie, ou 401."""
    token = request.cookies.get(COOKIE)
    if token:
        sessao = db.get(Sessao, hash_token(token))
        if sessao and sessao.expira_em > datetime.now(UTC):
            usuario = db.get(Usuario, sessao.usuario_id)
            if usuario:
                return usuario
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Faça login para continuar")


Logado = Annotated[Usuario, Depends(usuario_atual)]


@rotas.post("/login", response_model=EuSaida)
def login(
    entrada: LoginEntrada,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(sessao_db)],
) -> EuSaida:
    config = _config(request)
    limite: LimiteDeTentativas = request.app.state.limite_login
    ip = request.client.host if request.client else "?"
    if limite.bloqueado(ip):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas tentativas. Espere um minuto.")

    usuario = db.scalar(select(Usuario).where(Usuario.email == entrada.email.strip().lower()))
    if not conferir_senha(usuario.senha_hash if usuario else None, entrada.senha) or usuario is None:
        limite.registrar_falha(ip)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha incorretos")

    limite.zerar(ip)
    token, token_hash = novo_token()
    validade = timedelta(days=config.sessao_dias)
    db.add(Sessao(token_hash=token_hash, usuario_id=usuario.id, expira_em=datetime.now(UTC) + validade))
    response.set_cookie(
        COOKIE,
        token,
        max_age=int(validade.total_seconds()),
        httponly=True,
        secure=config.cookie_seguro,
        samesite="lax",
        path="/",
    )
    return EuSaida(email=usuario.email)


@rotas.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Annotated[Session, Depends(sessao_db)]) -> None:
    token = request.cookies.get(COOKIE)
    if token:
        db.execute(delete(Sessao).where(Sessao.token_hash == hash_token(token)))
    response.delete_cookie(COOKIE, path="/")


@rotas.get("/eu", response_model=EuSaida)
def eu(usuario: Logado) -> EuSaida:
    return EuSaida(email=usuario.email)
