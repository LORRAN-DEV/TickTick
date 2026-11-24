"""Lembretes (ADR 0008): quando cada lembrete dispara e a varredura que envia os vencidos.

Lembrete é o campo `lembretes: [{"antes": minutos}]` da tarefa (documento JSONB, ADR 0005).
Referência: `data` + `hora` no fuso do usuário; sem hora, 09:00. Disparo = referência − antes.
"""

import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import Engine, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .modelos import Adiamento, LembreteEnviado, Registro, Usuario
from .push import Enviador, enviador_real, enviar

log = logging.getLogger("ticktick.lembretes")

HORA_SEM_HORA = "09:00"
ATRASO_MAXIMO = timedelta(hours=6)
MAX_ANTES = 7 * 24 * 60  # uma semana, em minutos


def fuso(nome: str) -> ZoneInfo:
    try:
        return ZoneInfo(nome)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("America/Sao_Paulo")


def referencia(tarefa: dict[str, Any], tz: ZoneInfo) -> datetime | None:
    """Data e hora da tarefa (ou 09:00) no fuso, em UTC. None se a tarefa não tem data válida."""
    try:
        d = date.fromisoformat(str(tarefa.get("data")))
        h, m = (int(x) for x in str(tarefa.get("hora") or HORA_SEM_HORA).split(":"))
        return datetime(d.year, d.month, d.day, h, m, tzinfo=tz).astimezone(UTC)
    except (TypeError, ValueError):
        return None


def disparos(tarefa: dict[str, Any], tz: ZoneInfo) -> list[datetime]:
    """Instantes (UTC) em que os lembretes da tarefa disparam, em ordem, sem repetir."""
    ref = referencia(tarefa, tz)
    lembretes = tarefa.get("lembretes")
    if ref is None or not isinstance(lembretes, list):
        return []
    instantes = set()
    for lembrete in lembretes:
        antes = lembrete.get("antes") if isinstance(lembrete, dict) else None
        if isinstance(antes, int) and not isinstance(antes, bool) and 0 <= antes <= MAX_ANTES:
            instantes.add(ref - timedelta(minutes=antes))
    return sorted(instantes)


def mensagem(tarefa: dict[str, Any], tz: ZoneInfo, agora: datetime, tarefa_id: str) -> dict[str, Any]:
    """Texto da notificação: título da tarefa e quando ela é ("Hoje às 15:00", "Amanhã", "05/12 às 09:00")."""
    ref = referencia(tarefa, tz)
    corpo = ""
    if ref is not None:
        local = ref.astimezone(tz)
        hoje = agora.astimezone(tz).date()
        dia = (
            "Hoje"
            if local.date() == hoje
            else "Amanhã"
            if local.date() == hoje + timedelta(days=1)
            else local.strftime("%d/%m")
        )
        corpo = f"{dia} às {local:%H:%M}" if tarefa.get("hora") else dia
        if ref < agora - timedelta(minutes=5):
            corpo += " (atrasada)"
    return {
        "tipo": "lembrete",
        "titulo": str(tarefa.get("titulo") or "Tarefa"),
        "corpo": corpo,
        "tarefaId": tarefa_id,
        "tag": f"lembrete-{tarefa_id}",
    }


@dataclass
class Relatorio:
    lembretes: int = 0
    adiamentos: int = 0
    pushes: int = 0
    detalhes: list[str] = field(default_factory=list)


def varrer(db: Session, agora: datetime, contato: str, enviador: Enviador = enviador_real) -> Relatorio:
    """Envia os lembretes vencidos (até 6 h de atraso) e os adiamentos vencidos. Cada um sai uma vez."""
    rel = Relatorio()
    usuarios = {u.id: u for u in db.scalars(select(Usuario)).all()}
    tarefas = db.scalars(
        select(Registro).where(
            Registro.tabela == "tarefas",
            text("jsonb_typeof(registros.dados->'lembretes') = 'array'"),
            text("jsonb_array_length(registros.dados->'lembretes') > 0"),
            text("registros.dados->>'status' = 'aberta'"),
            text("registros.dados->>'excluidoEm' IS NULL"),
            text("registros.dados->>'data' IS NOT NULL"),
        )
    ).all()
    for reg in tarefas:
        usuario = usuarios.get(reg.usuario_id)
        if usuario is None:
            continue
        tz = fuso(usuario.fuso)
        for instante in disparos(reg.dados, tz):
            if not (agora - ATRASO_MAXIMO <= instante <= agora):
                continue
            novo = db.execute(
                insert(LembreteEnviado)
                .values(usuario_id=reg.usuario_id, tarefa_id=reg.id, instante=instante)
                .on_conflict_do_nothing()
                .returning(LembreteEnviado.tarefa_id)
            ).first()
            if novo is None:
                continue  # já enviado
            r = enviar(db, reg.usuario_id, mensagem(reg.dados, tz, agora, reg.id), contato, enviador)
            rel.lembretes += 1
            rel.pushes += r.enviados
            rel.detalhes.append(f"{reg.id}@{instante.isoformat()}")

    for adiamento in db.scalars(
        select(Adiamento)
        .where(Adiamento.enviado_em.is_(None), Adiamento.quando <= agora)
        .with_for_update(skip_locked=True)
    ).all():
        adiamento.enviado_em = agora
        reg = db.get(Registro, (adiamento.usuario_id, "tarefas", adiamento.tarefa_id))
        usuario = usuarios.get(adiamento.usuario_id)
        ainda_aberta = (
            reg is not None and reg.dados.get("status") == "aberta" and not reg.dados.get("excluidoEm")
        )
        if not ainda_aberta or usuario is None or agora - adiamento.quando > ATRASO_MAXIMO:
            continue
        r = enviar(
            db,
            adiamento.usuario_id,
            mensagem(reg.dados, fuso(usuario.fuso), agora, reg.id),
            contato,
            enviador,
        )
        rel.adiamentos += 1
        rel.pushes += r.enviados

    # Faxina: registros de envio antigos não servem para nada.
    db.execute(
        LembreteEnviado.__table__.delete().where(LembreteEnviado.enviado_em < agora - timedelta(days=30))
    )
    db.execute(
        update(Adiamento)
        .where(Adiamento.enviado_em.is_(None), Adiamento.quando < agora - timedelta(days=30))
        .values(enviado_em=agora)
    )
    return rel


def adiar(db: Session, usuario_id: uuid.UUID, tarefa_id: str, minutos: int, agora: datetime) -> datetime:
    quando = agora + timedelta(minutes=minutos)
    db.add(Adiamento(usuario_id=usuario_id, tarefa_id=tarefa_id, quando=quando))
    return quando


def rodar_worker(engine: Engine, contato: str, uma_vez: bool = False) -> None:
    """Laço do serviço `lembretes`: varre no começo de cada minuto."""
    while True:
        try:
            with Session(engine) as db:
                rel = varrer(db, datetime.now(UTC), contato)
                db.commit()
            if rel.lembretes or rel.adiamentos:
                log.info(
                    "lembretes: %d, adiamentos: %d, notificações: %d",
                    rel.lembretes,
                    rel.adiamentos,
                    rel.pushes,
                )
        except Exception:
            log.exception("varredura de lembretes falhou; tento de novo no próximo minuto")
        if uma_vez:
            return
        time.sleep(60 - datetime.now(UTC).second + 1)
