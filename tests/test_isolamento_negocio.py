"""
Testes do nível "Negócio" (admin) — ver CLAUDE.md, seção "Três níveis de
acesso", e o aviso de segurança em schema_seguranca.sql sobre `app.is_admin`.

Roda contra o banco real configurado em .env (mesmo padrão usado em toda a
validação manual deste projeto) -- cria e apaga só dados descartáveis
(profissional/admin/cliente com e-mail/subdomínio únicos por execução),
nunca toca nos dados reais já cadastrados.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.security import hash_senha
from app.db.base import SessionLocalAdmin
from app.main import app
from app.models.admin import Admin

client = TestClient(app)


def _criar_profissional_teste():
    suffix = uuid.uuid4().hex[:8]
    email = f"pytest.prof.{suffix}@example.com"
    resp = client.post(
        "/auth/cadastro",
        json={
            "nome": "Pytest Profissional",
            "email": email,
            "senha": "SenhaPytest123!",
            "subdominio": f"pytest-prof-{suffix}",
        },
    )
    assert resp.status_code == 201
    return {"email": email, "token": resp.json()["access_token"]}


def _apagar_profissional_teste(email: str):
    with SessionLocalAdmin() as db:
        db.execute(text("DELETE FROM profissionais WHERE email = :email"), {"email": email})
        db.commit()


@pytest.fixture
def profissional_teste():
    dados = _criar_profissional_teste()
    yield dados
    _apagar_profissional_teste(dados["email"])


@pytest.fixture
def admin_teste():
    suffix = uuid.uuid4().hex[:8]
    email = f"pytest.admin.{suffix}@example.com"
    senha = "SenhaPytest123!"
    with SessionLocalAdmin() as db:
        admin = Admin(nome="Pytest Admin", email=email, senha_hash=hash_senha(senha))
        db.add(admin)
        db.commit()
        admin_id = str(admin.id)
    yield {"email": email, "senha": senha, "id": admin_id}
    with SessionLocalAdmin() as db:
        db.execute(text("DELETE FROM admins WHERE id = :id"), {"id": admin_id})
        db.commit()


# ----------------------------------------------------------------------------
# 1. Rotas /negocio/* rejeitam quem não é um admin genuíno
# ----------------------------------------------------------------------------


@pytest.mark.parametrize("rota", ["/negocio/metricas", "/negocio/planejadores"])
def test_rota_negocio_sem_token_e_401(rota):
    resp = client.get(rota)
    assert resp.status_code == 401


@pytest.mark.parametrize("rota", ["/negocio/metricas", "/negocio/planejadores"])
def test_rota_negocio_rejeita_token_de_profissional_comum(profissional_teste, rota):
    headers = {"Authorization": f"Bearer {profissional_teste['token']}"}
    resp = client.get(rota, headers=headers)
    assert resp.status_code == 401


def test_rota_negocio_rejeita_token_invalido():
    headers = {"Authorization": "Bearer token-forjado-qualquer"}
    resp = client.get("/negocio/metricas", headers=headers)
    assert resp.status_code == 401


# ----------------------------------------------------------------------------
# 2. Fluxo de admin genuíno funciona, e o token dele não vaza pros outros níveis
# ----------------------------------------------------------------------------


def test_admin_login_e_metricas(admin_teste):
    resp = client.post("/negocio/login", json={"email": admin_teste["email"], "senha": admin_teste["senha"]})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    resp = client.get("/negocio/metricas", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    corpo = resp.json()
    assert "planejadores_ativos" in corpo
    assert "mrr" in corpo


def test_admin_login_senha_errada_e_401(admin_teste):
    resp = client.post("/negocio/login", json={"email": admin_teste["email"], "senha": "senha-errada"})
    assert resp.status_code == 401


def test_token_de_admin_nao_acessa_rotas_de_profissional(admin_teste):
    resp = client.post("/negocio/login", json={"email": admin_teste["email"], "senha": admin_teste["senha"]})
    token = resp.json()["access_token"]

    resp = client.get("/clientes", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


# ----------------------------------------------------------------------------
# 3. O ponto mais importante: profissional comum NUNCA consegue setar/forjar
#    app.is_admin sozinho, por nenhuma via de request (header, query, body).
#    Prova disso: profissional B tenta essas vias e continua só enxergando o
#    PRÓPRIO cliente via GET /clientes -- nunca o do profissional A.
# ----------------------------------------------------------------------------


@pytest.fixture
def dois_profissionais_com_clientes():
    prof_a = _criar_profissional_teste()
    prof_b = _criar_profissional_teste()

    resp = client.post(
        "/clientes",
        json={
            "nome": "Cliente do Profissional A",
            "tipo": "PF",
            "documento": "11122233344",
            "nickname": f"clia{uuid.uuid4().hex[:8]}",
            "senha": "senhacliente123",
        },
        headers={"Authorization": f"Bearer {prof_a['token']}"},
    )
    assert resp.status_code == 201
    cliente_a_id = resp.json()["id"]

    yield {"prof_a": prof_a, "prof_b": prof_b, "cliente_a_id": cliente_a_id}

    # TestClient (httpx) não aceita `json=` no atalho .delete() -- precisa
    # do .request() genérico pra mandar corpo num DELETE.
    client.request(
        "DELETE",
        f"/clientes/{cliente_a_id}",
        json={},
        headers={"Authorization": f"Bearer {prof_a['token']}"},
    )
    _apagar_profissional_teste(prof_a["email"])
    _apagar_profissional_teste(prof_b["email"])


def test_profissional_nao_forja_bypass_via_header(dois_profissionais_com_clientes):
    ctx = dois_profissionais_com_clientes
    headers = {
        "Authorization": f"Bearer {ctx['prof_b']['token']}",
        "X-Is-Admin": "true",
        "app.is_admin": "true",
    }
    resp = client.get("/clientes", headers=headers)
    assert resp.status_code == 200
    ids_vistos = [c["id"] for c in resp.json()]
    assert ctx["cliente_a_id"] not in ids_vistos, "profissional B nunca pode ver cliente do profissional A"


def test_profissional_nao_forja_bypass_via_query_param(dois_profissionais_com_clientes):
    ctx = dois_profissionais_com_clientes
    headers = {"Authorization": f"Bearer {ctx['prof_b']['token']}"}
    resp = client.get("/clientes?is_admin=true&app.is_admin=true", headers=headers)
    assert resp.status_code == 200
    ids_vistos = [c["id"] for c in resp.json()]
    assert ctx["cliente_a_id"] not in ids_vistos


def test_profissional_nao_forja_bypass_via_body(dois_profissionais_com_clientes):
    ctx = dois_profissionais_com_clientes
    headers = {"Authorization": f"Bearer {ctx['prof_b']['token']}"}
    # PATCH aceita um corpo -- tenta injetar is_admin nele também. A rota nem
    # tem esse campo no schema, mas o teste documenta a intenção: nenhuma via
    # de request influencia a GUC de RLS.
    resp = client.patch(
        f"/clientes/{ctx['cliente_a_id']}",
        json={"is_admin": True, "nome": "Tentativa de invasão"},
        headers=headers,
    )
    # RLS filtra ANTES de qualquer lógica de negócio enxergar a linha --
    # cliente de outro profissional simplesmente não é encontrado (404), não
    # vaza nem a existência dele.
    assert resp.status_code == 404
