"""Objetivo 7, critérios 4 a 9: push, pull, conflito por campo, idempotência, exclusão lógica e isolamento."""

from datetime import UTC, datetime, timedelta

import pytest

from ticktick_api.cli import criar_usuario

from .conftest import SENHA, URL, entrar, novo_cliente

T0 = datetime(2026, 11, 24, 13, 0, tzinfo=UTC)


def mud(id_: str, campos: dict, quando: datetime = T0, tabela: str = "tarefas") -> dict:
    return {"tabela": tabela, "id": id_, "campos": campos, "alterado_em": quando.isoformat()}


def push(cliente, *mudancas: dict) -> dict:
    r = cliente.post("/api/sync/push", json={"mudancas": list(mudancas)})
    assert r.status_code == 200, r.text
    return r.json()


def pull(cliente, since: int = 0, limite: int = 500) -> dict:
    r = cliente.get("/api/sync/pull", params={"since": since, "limite": limite})
    assert r.status_code == 200, r.text
    return r.json()


def test_4_push_grava_e_pull_devolve(logado):
    r = push(
        logado,
        mud("t1", {"titulo": "pagar boleto", "prioridade": 3, "tags": ["casa"], "data": "2026-11-25"}),
        mud("inbox", {"nome": "Inbox", "ordem": "0"}, tabela="listas"),
        mud("m1", {"valor": 12.5, "tipo": "Despesa"}, tabela="movs"),
    )
    assert [x["aplicados"] for x in r["resultados"]] == [
        ["titulo", "prioridade", "tags", "data"],
        ["nome", "ordem"],
        ["valor", "tipo"],
    ]
    assert r["versao"] == 3
    p = pull(logado)
    assert [(x["tabela"], x["id"]) for x in p["registros"]] == [
        ("tarefas", "t1"),
        ("listas", "inbox"),
        ("movs", "m1"),
    ]
    assert p["registros"][0]["dados"] == {
        "id": "t1",
        "titulo": "pagar boleto",
        "prioridade": 3,
        "tags": ["casa"],
        "data": "2026-11-25",
    }
    assert p["versao"] == 3 and p["mais"] is False


@pytest.mark.parametrize(
    "mudanca",
    [
        mud("t1", {"titulo": "x"}, tabela="usuarios"),  # tabela desconhecida
        mud("t1", {}),  # sem campos
        mud("t1", {"id": "outro"}),  # id não vai em campos
        mud("t1", {"1campo": "x"}),  # nome de campo inválido
        mud("t1", {"a;b": "x"}),
        mud("../x", {"titulo": "x"}),  # id inválido
        mud("t1", {"titulo": "x" * 70_000}),  # passa de 64 KB
        {**mud("t1", {"titulo": "x"}), "extra": 1},  # chave desconhecida
        {**mud("t1", {"titulo": "x"}), "alterado_em": "2026-11-24T13:00:00"},  # sem fuso
    ],
)
def test_4_lote_invalido_e_422_e_nada_e_gravado(logado, mudanca):
    r = logado.post("/api/sync/push", json={"mudancas": [mud("ok", {"titulo": "válida"}), mudanca]})
    assert r.status_code == 422
    assert pull(logado)["registros"] == []


def test_4_lote_grande_demais_e_422(logado):
    r = logado.post("/api/sync/push", json={"mudancas": [mud(f"t{i}", {"x": i}) for i in range(501)]})
    assert r.status_code == 422


def test_5_campos_diferentes_em_aparelhos_diferentes_nao_conflitam(logado):
    push(logado, mud("t1", {"titulo": "original", "data": "2026-11-25"}))
    # aparelho A muda o título; aparelho B (offline, mudou antes) muda a data
    push(logado, mud("t1", {"titulo": "do aparelho A"}, T0 + timedelta(minutes=10)))
    push(logado, mud("t1", {"data": "2026-11-30"}, T0 + timedelta(minutes=5)))
    dados = pull(logado)["registros"][0]["dados"]
    assert dados["titulo"] == "do aparelho A"
    assert dados["data"] == "2026-11-30"


def test_5_mesmo_campo_vence_o_mais_recente(logado):
    push(logado, mud("t1", {"titulo": "mais nova"}, T0 + timedelta(minutes=10)))
    r = push(logado, mud("t1", {"titulo": "mais velha", "notas": "nova nota"}, T0 + timedelta(minutes=5)))
    assert r["resultados"][0]["aplicados"] == ["notas"]
    assert r["resultados"][0]["ignorados"] == ["titulo"]
    dados = pull(logado)["registros"][0]["dados"]
    assert dados["titulo"] == "mais nova" and dados["notas"] == "nova nota"


def test_5_mudanca_do_futuro_conta_como_agora(logado):
    futuro = datetime.now(UTC) + timedelta(days=365)
    push(logado, mud("t1", {"titulo": "relógio adiantado"}, futuro))
    # uma edição feita "agora" (depois do push acima) precisa poder vencer
    push(logado, mud("t1", {"titulo": "edição normal"}, datetime.now(UTC) + timedelta(seconds=1)))
    assert pull(logado)["registros"][0]["dados"]["titulo"] == "edição normal"


def test_6_mesmo_lote_duas_vezes_nao_muda_nada(logado):
    lote = [mud("t1", {"titulo": "a"}), mud("t2", {"titulo": "b"})]
    primeiro = push(logado, *lote)
    segundo = push(logado, *lote)
    assert all(x["aplicados"] == [] for x in segundo["resultados"])
    assert [x["server_version"] for x in segundo["resultados"]] == [
        x["server_version"] for x in primeiro["resultados"]
    ]
    assert segundo["versao"] == primeiro["versao"]
    assert pull(logado, since=primeiro["versao"])["registros"] == []


def test_7_pull_desde_uma_versao_em_paginas(logado):
    for i in range(5):
        push(logado, mud(f"t{i}", {"titulo": f"tarefa {i}"}))
    push(logado, mud("t1", {"titulo": "editada"}, T0 + timedelta(minutes=1)))  # t1 vai para o fim (versão 6)

    p1 = pull(logado, since=0, limite=2)
    assert [x["id"] for x in p1["registros"]] == ["t0", "t2"] and p1["mais"] is True and p1["versao"] == 3
    p2 = pull(logado, since=p1["versao"], limite=2)
    assert [x["id"] for x in p2["registros"]] == ["t3", "t4"] and p2["mais"] is True
    p3 = pull(logado, since=p2["versao"], limite=2)
    assert [x["id"] for x in p3["registros"]] == ["t1"] and p3["mais"] is False
    assert p3["registros"][0]["dados"]["titulo"] == "editada"
    assert pull(logado, since=p3["versao"]) == {"registros": [], "versao": p3["versao"], "mais": False}


def test_7_parametros_invalidos(logado):
    assert logado.get("/api/sync/pull", params={"since": -1}).status_code == 422
    assert logado.get("/api/sync/pull", params={"limite": 0}).status_code == 422
    assert logado.get("/api/sync/pull", params={"limite": 1001}).status_code == 422


def test_8_exclusao_logica_vem_no_pull(logado):
    push(logado, mud("t1", {"titulo": "apagar"}))
    v = push(logado, mud("t1", {"excluidoEm": "2026-11-24T14:00:00.000Z"}, T0 + timedelta(hours=1)))["versao"]
    p = pull(logado, since=v - 1)
    assert p["registros"][0]["dados"] == {
        "id": "t1",
        "titulo": "apagar",
        "excluidoEm": "2026-11-24T14:00:00.000Z",
    }


def test_9_um_usuario_nao_ve_nem_altera_os_registros_do_outro(app, logado):
    push(logado, mud("t1", {"titulo": "do primeiro usuário"}))
    criar_usuario("outra@exemplo.com", SENHA, URL)
    outra = entrar(novo_cliente(app), "outra@exemplo.com")
    assert pull(outra)["registros"] == []
    push(outra, mud("t1", {"titulo": "da outra pessoa"}, T0 + timedelta(hours=1)))
    assert pull(logado)["registros"][0]["dados"]["titulo"] == "do primeiro usuário"
    assert [r["dados"]["titulo"] for r in pull(outra)["registros"]] == ["da outra pessoa"]


def test_formulario_de_outro_site_nao_faz_push(logado):
    """Com cookie SameSite=Lax e corpo JSON obrigatório, um <form> de outro site não grava nada (ADR 0005)."""
    r = logado.post(
        "/api/sync/push",
        content="mudancas=x",
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 422
    assert pull(logado)["registros"] == []
