"""Objetivo 10: lembretes e Web Push (ADR 0008). O serviço de push é trocado por um falso."""

import json
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from pywebpush import WebPushException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ticktick_api.cli import criar_usuario
from ticktick_api.lembretes import disparos, mensagem, varrer
from ticktick_api.modelos import PushAssinatura, Usuario

from .conftest import SENHA, URL, entrar, novo_cliente

SP = ZoneInfo("America/Sao_Paulo")
CONTATO = "mailto:teste@localhost.localdomain"
# Terça, 24/11/2026, 10:00 em São Paulo = 13:00 UTC
AGORA = datetime(2026, 11, 24, 13, 0, tzinfo=UTC)


class PushFalso:
    def __init__(self) -> None:
        self.enviados: list[tuple[str, dict]] = []
        self.sumidos: set[str] = set()  # endpoints que respondem 410

    def __call__(self, inscricao, dados, vapid, claims) -> None:
        assert claims == {"sub": CONTATO} or claims["sub"].startswith("mailto:")
        if inscricao["endpoint"] in self.sumidos:
            raise WebPushException("Gone", response=SimpleNamespace(status_code=410))
        self.enviados.append((inscricao["endpoint"], json.loads(dados)))


@pytest.fixture
def push(app) -> PushFalso:
    falso = PushFalso()
    app.state.enviador_push = falso
    return falso


def inscrever(cliente, endpoint="https://push.exemplo/aparelho-1", fuso="America/Sao_Paulo"):
    r = cliente.post(
        "/api/push/assinaturas",
        json={
            "endpoint": endpoint,
            "keys": {"p256dh": "B" + "x" * 86, "auth": "a" * 22},
            "fuso": fuso,
            "aparelho": "Android",
            "expirationTime": None,
        },
    )
    assert r.status_code == 204, r.text


def tarefa(cliente, id_: str, **campos) -> None:
    dados = {"titulo": id_, "status": "aberta", "data": "2026-11-24", "hora": "10:00", **campos}
    r = cliente.post(
        "/api/sync/push",
        json={
            "mudancas": [{"tabela": "tarefas", "id": id_, "campos": dados, "alterado_em": AGORA.isoformat()}]
        },
    )
    assert r.status_code == 200, r.text


def varrer_em(engine, quando: datetime, push: PushFalso):
    with Session(engine) as db:
        rel = varrer(db, quando, CONTATO, push)
        db.commit()
    return rel


# --------------------------------------------------------------------------------------------- regras


def test_3_disparos_na_hora_antes_e_sem_hora():
    assert disparos(
        {"data": "2026-11-24", "hora": "15:00", "lembretes": [{"antes": 0}, {"antes": 15}]}, SP
    ) == [
        datetime(2026, 11, 24, 17, 45, tzinfo=UTC),
        datetime(2026, 11, 24, 18, 0, tzinfo=UTC),
    ]
    # sem hora: 09:00 do dia; "1 dia antes" = 09:00 da véspera
    assert disparos({"data": "2026-11-25", "hora": None, "lembretes": [{"antes": 1440}]}, SP) == [
        datetime(2026, 11, 24, 12, 0, tzinfo=UTC)
    ]


def test_disparos_ignoram_lixo_e_repetidos():
    t = {
        "data": "2026-11-24",
        "hora": "10:00",
        "lembretes": [{"antes": 0}, {"antes": 0}, {"antes": -5}, {"x": 1}, 3, {"antes": True}],
    }
    assert disparos(t, SP) == [datetime(2026, 11, 24, 13, 0, tzinfo=UTC)]
    assert disparos({"data": "lixo", "lembretes": [{"antes": 0}]}, SP) == []
    assert disparos({"data": "2026-11-24", "lembretes": None}, SP) == []


def test_mensagem_diz_quando_e():
    m = mensagem({"titulo": "reunião", "data": "2026-11-24", "hora": "15:00"}, SP, AGORA, "t1")
    assert m == {
        "tipo": "lembrete",
        "titulo": "reunião",
        "corpo": "Hoje às 15:00",
        "tarefaId": "t1",
        "tag": "lembrete-t1",
    }
    assert mensagem({"titulo": "x", "data": "2026-11-25", "hora": None}, SP, AGORA, "t")["corpo"] == "Amanhã"
    assert (
        mensagem({"titulo": "x", "data": "2026-11-24", "hora": "08:00"}, SP, AGORA, "t")["corpo"]
        == "Hoje às 08:00 (atrasada)"
    )


# ------------------------------------------------------------------------------------------ aparelhos


def test_4_inscrever_guarda_o_aparelho_e_o_fuso(engine, logado, push):
    inscrever(logado, fuso="America/Manaus")
    inscrever(logado)  # de novo: não duplica
    with Session(engine) as db:
        assert db.scalars(select(PushAssinatura)).all()[0].aparelho == "Android"
        assert len(db.scalars(select(PushAssinatura)).all()) == 1
        assert db.scalars(select(Usuario)).one().fuso == "America/Sao_Paulo"
    inscrever(logado, fuso="Fuso/Inventado")
    with Session(engine) as db:
        assert db.scalars(select(Usuario)).one().fuso == "America/Sao_Paulo"


def test_4_teste_chega_em_todos_os_aparelhos_e_inscricao_vencida_some(engine, logado, push):
    inscrever(logado, "https://push.exemplo/a")
    inscrever(logado, "https://push.exemplo/b")
    push.sumidos.add("https://push.exemplo/b")
    r = logado.post("/api/push/teste").json()
    assert r == {"enviados": 1, "removidos": 1, "falhas": 0}
    assert push.enviados[0][1]["tipo"] == "teste"
    with Session(engine) as db:
        assert [a.endpoint for a in db.scalars(select(PushAssinatura))] == ["https://push.exemplo/a"]


def test_4_chave_publica_e_estavel_e_exige_login(cliente, logado):
    c1 = logado.get("/api/push/chave").json()["chave"]
    assert c1 == logado.get("/api/push/chave").json()["chave"]
    assert len(c1) == 87  # 65 bytes em base64url sem "="
    logado.post("/api/auth/logout")
    assert logado.get("/api/push/chave").status_code == 401


def test_4_validacao_da_inscricao(logado):
    r = logado.post(
        "/api/push/assinaturas", json={"endpoint": "http://inseguro", "keys": {"p256dh": "x", "auth": "y"}}
    )
    assert r.status_code == 422


def test_remover_aparelho(engine, logado, push):
    inscrever(logado)
    assert (
        logado.request(
            "DELETE", "/api/push/assinaturas", json={"endpoint": "https://push.exemplo/aparelho-1"}
        ).status_code
        == 204
    )
    with Session(engine) as db:
        assert db.scalars(select(PushAssinatura)).all() == []


# ------------------------------------------------------------------------------------------- varredura


def test_5_dispara_no_horario_uma_vez_so(engine, logado, push):
    inscrever(logado)
    tarefa(logado, "reuniao", hora="10:15", lembretes=[{"antes": 15}])  # 10:00 SP = 13:00 UTC
    assert varrer_em(engine, AGORA - timedelta(minutes=1), push).lembretes == 0
    rel = varrer_em(engine, AGORA, push)
    assert rel.lembretes == 1 and rel.pushes == 1
    assert push.enviados[0][1] == {
        "tipo": "lembrete",
        "titulo": "reuniao",
        "corpo": "Hoje às 10:15",
        "tarefaId": "reuniao",
        "tag": "lembrete-reuniao",
    }
    assert varrer_em(engine, AGORA + timedelta(minutes=1), push).lembretes == 0  # não repete


def test_6_concluida_lixeira_ou_sem_data_nao_dispara(engine, logado, push):
    inscrever(logado)
    tarefa(logado, "feita", status="concluida", lembretes=[{"antes": 0}])
    tarefa(logado, "apagada", excluidoEm="2026-11-24T12:00:00Z", lembretes=[{"antes": 0}])
    tarefa(logado, "sem-data", data=None, lembretes=[{"antes": 0}])
    tarefa(logado, "sem-lembrete")
    assert varrer_em(engine, AGORA, push).lembretes == 0


def test_6_mudar_a_data_dispara_no_novo_horario(engine, logado, push):
    inscrever(logado)
    tarefa(logado, "t", lembretes=[{"antes": 0}])
    varrer_em(engine, AGORA, push)
    # recorrente concluída: a data avança para amanhã (o app faz isso e sincroniza)
    r = logado.post(
        "/api/sync/push",
        json={
            "mudancas": [
                {
                    "tabela": "tarefas",
                    "id": "t",
                    "campos": {"data": "2026-11-25"},
                    "alterado_em": (AGORA + timedelta(minutes=1)).isoformat(),
                }
            ]
        },
    )
    assert r.status_code == 200
    assert varrer_em(engine, AGORA + timedelta(hours=1), push).lembretes == 0
    assert varrer_em(engine, AGORA + timedelta(days=1), push).lembretes == 1
    assert len(push.enviados) == 2


def test_8_servidor_desligado_ate_6h_ainda_avisa_depois_descarta(engine, logado, push):
    inscrever(logado)
    tarefa(logado, "atrasada", hora="10:00", lembretes=[{"antes": 0}])
    tarefa(logado, "muito-atrasada", data="2026-11-23", hora="10:00", lembretes=[{"antes": 0}])
    rel = varrer_em(engine, AGORA + timedelta(hours=5), push)
    assert rel.detalhes == ["atrasada@2026-11-24T13:00:00+00:00"]
    assert push.enviados[0][1]["corpo"] == "Hoje às 10:00 (atrasada)"


def test_7_adiar_manda_de_novo_10_min_depois(engine, app, logado, push):
    inscrever(logado)
    tarefa(logado, "t", lembretes=[{"antes": 0}])
    r = logado.post("/api/lembretes/adiar", json={"tarefaId": "t"})
    assert r.status_code == 200
    quando = datetime.fromisoformat(r.json()["quando"])
    assert varrer_em(engine, quando - timedelta(seconds=1), push).adiamentos == 0
    assert varrer_em(engine, quando, push).adiamentos == 1
    assert varrer_em(engine, quando + timedelta(minutes=1), push).adiamentos == 0  # uma vez só


def test_7_adiamento_de_tarefa_concluida_nao_sai(engine, logado, push):
    inscrever(logado)
    tarefa(logado, "t", lembretes=[{"antes": 0}])
    quando = datetime.fromisoformat(
        logado.post("/api/lembretes/adiar", json={"tarefaId": "t", "minutos": 5}).json()["quando"]
    )
    logado.post(
        "/api/sync/push",
        json={
            "mudancas": [
                {
                    "tabela": "tarefas",
                    "id": "t",
                    "campos": {"status": "concluida"},
                    "alterado_em": datetime.now(UTC).isoformat(),
                }
            ]
        },
    )
    assert varrer_em(engine, quando, push).adiamentos == 0


def test_adiar_exige_login_e_valida(cliente, logado):
    assert logado.post("/api/lembretes/adiar", json={"tarefaId": "t", "minutos": 0}).status_code == 422
    assert cliente.post("/api/lembretes/adiar", json={"tarefaId": "../x"}).status_code in (401, 422)


def test_cada_usuario_recebe_so_os_seus(app, engine, logado, push):
    inscrever(logado, "https://push.exemplo/meu")
    criar_usuario("outra@exemplo.com", SENHA, URL)
    outra = entrar(novo_cliente(app), "outra@exemplo.com")
    inscrever(outra, "https://push.exemplo/dela")
    tarefa(outra, "da-outra", lembretes=[{"antes": 0}])
    varrer_em(engine, AGORA, push)
    assert [e for e, _ in push.enviados] == ["https://push.exemplo/dela"]
