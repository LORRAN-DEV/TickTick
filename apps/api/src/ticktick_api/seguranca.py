"""Senhas (Argon2), tokens de sessão e limite de tentativas de login."""

import hashlib
import secrets
import threading
import time
from collections import defaultdict, deque

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()
# Hash de uma senha qualquer: conferir contra ele quando o e-mail não existe gasta o mesmo tempo,
# para a resposta não revelar quais e-mails têm conta.
_HASH_FALSO = _hasher.hash("senha-que-nao-existe")


def hash_senha(senha: str) -> str:
    return _hasher.hash(senha)


def conferir_senha(hash_salvo: str | None, senha: str) -> bool:
    try:
        return _hasher.verify(hash_salvo or _HASH_FALSO, senha) and hash_salvo is not None
    except (VerificationError, InvalidHashError):
        return False


def novo_token() -> tuple[str, str]:
    """Token aleatório para o cookie e o hash dele para o banco."""
    token = secrets.token_urlsafe(32)
    return token, hash_token(token)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class LimiteDeTentativas:
    """Conta logins errados por chave (IP) numa janela de tempo. Em memória: vale por processo."""

    def __init__(self, maximo: int, janela_segundos: float) -> None:
        self.maximo = maximo
        self.janela = janela_segundos
        self._falhas: dict[str, deque[float]] = defaultdict(deque)
        self._trava = threading.Lock()

    def _limpar(self, chave: str, agora: float) -> deque[float]:
        fila = self._falhas[chave]
        while fila and agora - fila[0] > self.janela:
            fila.popleft()
        return fila

    def bloqueado(self, chave: str) -> bool:
        with self._trava:
            return len(self._limpar(chave, time.monotonic())) >= self.maximo

    def registrar_falha(self, chave: str) -> None:
        with self._trava:
            agora = time.monotonic()
            self._limpar(chave, agora).append(agora)

    def zerar(self, chave: str) -> None:
        with self._trava:
            self._falhas.pop(chave, None)
