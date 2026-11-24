"""Web Push (ADR 0008): chaves VAPID, inscrições dos aparelhos e envio de notificações."""

import base64
import json
import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid02
from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .modelos import ConfigServidor, PushAssinatura

log = logging.getLogger("ticktick.push")

CHAVE_VAPID = "vapid_privada_pem"


def _vapid(db: Session) -> Vapid02:
    """Chave VAPID do servidor; gerada e guardada no banco na primeira vez."""
    linha = db.get(ConfigServidor, CHAVE_VAPID)
    if linha is None:
        nova = Vapid02()
        nova.generate_keys()
        linha = ConfigServidor(chave=CHAVE_VAPID, valor=nova.private_pem().decode())
        db.add(linha)
        db.flush()
    return Vapid02.from_pem(linha.valor.encode())


def chave_publica(db: Session) -> str:
    """Chave pública no formato que o navegador pede (`applicationServerKey`, base64url)."""
    crua = _vapid(db).public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return base64.urlsafe_b64encode(crua).rstrip(b"=").decode()


@dataclass
class Resultado:
    enviados: int = 0
    removidos: int = 0
    falhas: int = 0


# Quem de fato manda o push. Os testes trocam por um falso (sem rede).
Enviador = Callable[[dict[str, Any], str, Vapid02, dict[str, str]], None]


def enviador_real(inscricao: dict[str, Any], dados: str, vapid: Vapid02, claims: dict[str, str]) -> None:
    # TTL de 6 h: depois disso o lembrete já não ajuda (mesmo limite do worker).
    webpush(inscricao, dados, vapid_private_key=vapid, vapid_claims=dict(claims), ttl=6 * 3600, timeout=10)


def enviar(
    db: Session,
    usuario_id: uuid.UUID,
    mensagem: dict[str, Any],
    contato: str,
    enviador: Enviador = enviador_real,
) -> Resultado:
    """Manda a mensagem para todos os aparelhos do usuário. Inscrição vencida (404/410) é apagada."""
    vapid = _vapid(db)
    dados = json.dumps(mensagem, ensure_ascii=False)
    res = Resultado()
    for a in db.scalars(select(PushAssinatura).where(PushAssinatura.usuario_id == usuario_id)).all():
        info = {"endpoint": a.endpoint, "keys": {"p256dh": a.p256dh, "auth": a.auth}}
        try:
            enviador(info, dados, vapid, {"sub": contato})
            res.enviados += 1
        except WebPushException as e:
            status = e.response.status_code if e.response is not None else None
            if status in (404, 410):
                db.execute(delete(PushAssinatura).where(PushAssinatura.endpoint == a.endpoint))
                res.removidos += 1
            else:
                log.warning("push falhou (%s) para %s…", status, a.endpoint[:40])
                res.falhas += 1
        except Exception:
            log.exception("push falhou para %s…", a.endpoint[:40])
            res.falhas += 1
    return res
