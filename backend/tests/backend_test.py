"""
Backend tests for Sistema de Inscrições JKMA / Prefeitura SJR.
Cobre: register, login (CPF/e-mail), me, admin login, inscricoes,
admin cadastros/inscricoes (incl. cascade), stats, auth guards.
"""
import os
import random
import time

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if "REACT_APP_BACKEND_URL" in os.environ else None
if not BASE_URL:
    # fallback to frontend .env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break

API = f"{BASE_URL}/api"
ADMIN_USER = "donas"
ADMIN_PASS = "Seinao10@@"


def _rand_cpf():
    # 11-digit numeric string (not validated by checksum on server)
    return "".join(str(random.randint(0, 9)) for _ in range(11))


def _rand_email():
    return f"TEST_user_{int(time.time()*1000)}_{random.randint(1000,9999)}@teste.com"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/admin/login", json={"username": ADMIN_USER, "senha": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="session")
def candidate(s):
    """Create a candidate for cross-test reuse and clean it up at end."""
    cpf = _rand_cpf()
    email = _rand_email()
    payload = {
        "nome": "TEST Candidato Pytest",
        "cpf": cpf,
        "email": email,
        "telefone": "98999990000",
        "senha": "abc123",
    }
    r = s.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    yield {"token": data["token"], "user": data["user"], "senha": payload["senha"], "cpf": cpf, "email": email}
    # teardown - delete via admin
    try:
        admin = s.post(f"{API}/auth/admin/login", json={"username": ADMIN_USER, "senha": ADMIN_PASS}, timeout=10).json()["token"]
        s.delete(f"{API}/admin/cadastros/{data['user']['id']}", headers={"Authorization": f"Bearer {admin}"}, timeout=10)
    except Exception:
        pass


# ------------------------- health -------------------------
def test_health(s):
    r = s.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("status") == "ok"


# ------------------------- register -------------------------
def test_register_success_and_returns_token(s):
    cpf = _rand_cpf()
    email = _rand_email()
    r = s.post(f"{API}/auth/register", json={
        "nome": "TEST Reg User", "cpf": cpf, "email": email,
        "telefone": "98911112222", "senha": "abc123",
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
    assert data["user"]["email"] == email.lower()
    assert data["user"]["cpf"] == cpf
    # cleanup
    admin = s.post(f"{API}/auth/admin/login", json={"username": ADMIN_USER, "senha": ADMIN_PASS}, timeout=10).json()["token"]
    s.delete(f"{API}/admin/cadastros/{data['user']['id']}", headers={"Authorization": f"Bearer {admin}"}, timeout=10)


def test_register_duplicate_cpf(s, candidate):
    r = s.post(f"{API}/auth/register", json={
        "nome": "TEST Dup CPF", "cpf": candidate["cpf"], "email": _rand_email(),
        "telefone": "", "senha": "abc123",
    }, timeout=30)
    assert r.status_code == 400
    assert "CPF" in (r.json().get("detail") or "")


def test_register_duplicate_email(s, candidate):
    r = s.post(f"{API}/auth/register", json={
        "nome": "TEST Dup Email", "cpf": _rand_cpf(), "email": candidate["email"],
        "telefone": "", "senha": "abc123",
    }, timeout=30)
    assert r.status_code == 400
    assert "mail" in (r.json().get("detail") or "").lower()


def test_register_invalid_cpf(s):
    r = s.post(f"{API}/auth/register", json={
        "nome": "TEST Bad", "cpf": "123", "email": _rand_email(),
        "telefone": "", "senha": "abc123",
    }, timeout=30)
    # Pydantic min_length=11 → 422; if accepted but caught by normalize → 400
    assert r.status_code in (400, 422)


# ------------------------- login -------------------------
def test_login_with_cpf(s, candidate):
    r = s.post(f"{API}/auth/login", json={"identifier": candidate["cpf"], "senha": candidate["senha"]}, timeout=30)
    assert r.status_code == 200, r.text
    assert "token" in r.json()
    assert r.json()["user"]["cpf"] == candidate["cpf"]


def test_login_with_email(s, candidate):
    r = s.post(f"{API}/auth/login", json={"identifier": candidate["email"], "senha": candidate["senha"]}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email"] == candidate["email"].lower()


def test_login_wrong_password(s, candidate):
    r = s.post(f"{API}/auth/login", json={"identifier": candidate["email"], "senha": "errada123"}, timeout=30)
    assert r.status_code == 401


def test_login_nonexistent(s):
    r = s.post(f"{API}/auth/login", json={"identifier": "naoexiste@x.com", "senha": "x"}, timeout=30)
    assert r.status_code == 401


# ------------------------- me -------------------------
def test_me_with_token(s, candidate):
    r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {candidate['token']}"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == candidate["user"]["id"]
    assert "password_hash" not in data
    assert "_id" not in data


def test_me_without_token(s):
    r = s.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 401


def test_me_invalid_token(s):
    r = s.get(f"{API}/auth/me", headers={"Authorization": "Bearer not-a-jwt"}, timeout=30)
    assert r.status_code == 401


# ------------------------- admin auth -------------------------
def test_admin_login_success(admin_token):
    assert isinstance(admin_token, str) and len(admin_token) > 20


def test_admin_login_wrong_password(s):
    r = s.post(f"{API}/auth/admin/login", json={"username": ADMIN_USER, "senha": "wrong"}, timeout=30)
    assert r.status_code == 401


def test_admin_login_wrong_user(s):
    r = s.post(f"{API}/auth/admin/login", json={"username": "outro", "senha": ADMIN_PASS}, timeout=30)
    assert r.status_code == 401


# ------------------------- inscricoes -------------------------
def test_create_inscricao_authenticated(s, candidate):
    r = s.post(f"{API}/inscricoes", json={
        "concurso": "Saúde", "cargo": "Enfermeiro", "cota": "ampla", "cidade_prova": "SJR",
    }, headers={"Authorization": f"Bearer {candidate['token']}"}, timeout=30)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["concurso"] == "Saúde"
    assert doc["status"] == "aguardando_pagamento"
    assert doc["user_id"] == candidate["user"]["id"]
    assert "_id" not in doc
    # verify via GET /inscricoes/minhas
    r2 = s.get(f"{API}/inscricoes/minhas", headers={"Authorization": f"Bearer {candidate['token']}"}, timeout=30)
    assert r2.status_code == 200
    ids = [d["id"] for d in r2.json()]
    assert doc["id"] in ids


def test_create_inscricao_without_token(s):
    r = s.post(f"{API}/inscricoes", json={"concurso": "Saúde"}, timeout=30)
    assert r.status_code == 401


# ------------------------- admin endpoints -------------------------
def test_admin_cadastros_list(s, admin_token, candidate):
    r = s.get(f"{API}/admin/cadastros", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "total" in data and "items" in data
    ids = [u["id"] for u in data["items"]]
    assert candidate["user"]["id"] in ids
    # Ensure password_hash not leaked
    assert all("password_hash" not in u for u in data["items"])


def test_admin_cadastros_search(s, admin_token, candidate):
    r = s.get(f"{API}/admin/cadastros", params={"q": candidate["email"]},
              headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert any(u["email"] == candidate["email"].lower() for u in data["items"])


def test_admin_cadastros_forbidden_with_candidate_token(s, candidate):
    r = s.get(f"{API}/admin/cadastros", headers={"Authorization": f"Bearer {candidate['token']}"}, timeout=30)
    assert r.status_code == 403


def test_admin_cadastros_without_token(s):
    r = s.get(f"{API}/admin/cadastros", timeout=30)
    assert r.status_code == 401


def test_admin_inscricoes_list(s, admin_token):
    r = s.get(f"{API}/admin/inscricoes", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "total" in data and isinstance(data["items"], list)


def test_admin_stats(s, admin_token):
    r = s.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "total_cadastros" in data and "total_inscricoes" in data
    assert isinstance(data["total_cadastros"], int)


def test_delete_inscricao(s, admin_token, candidate):
    # create
    r = s.post(f"{API}/inscricoes", json={"concurso": "Educação"},
               headers={"Authorization": f"Bearer {candidate['token']}"}, timeout=30)
    insc_id = r.json()["id"]
    # delete
    r = s.delete(f"{API}/admin/inscricoes/{insc_id}",
                 headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    assert r.json().get("deleted") is True
    # verify gone
    r2 = s.get(f"{API}/admin/inscricoes", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    ids = [d["id"] for d in r2.json()["items"]]
    assert insc_id not in ids


def test_delete_cadastro_cascade(s, admin_token):
    # Create dedicated user + inscription, then delete user, check inscription gone.
    cpf = _rand_cpf()
    email = _rand_email()
    reg = s.post(f"{API}/auth/register", json={
        "nome": "TEST Cascade", "cpf": cpf, "email": email,
        "telefone": "", "senha": "abc123",
    }, timeout=30).json()
    tok = reg["token"]
    uid = reg["user"]["id"]
    insc = s.post(f"{API}/inscricoes", json={"concurso": "Guarda"},
                  headers={"Authorization": f"Bearer {tok}"}, timeout=30).json()
    insc_id = insc["id"]

    r = s.delete(f"{API}/admin/cadastros/{uid}",
                 headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    # Inscrição deve ter sido removida (cascade)
    r2 = s.get(f"{API}/admin/inscricoes", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    ids = [d["id"] for d in r2.json()["items"]]
    assert insc_id not in ids, "cascade failed: inscricao still exists"


def test_delete_nonexistent_cadastro(s, admin_token):
    r = s.delete(f"{API}/admin/cadastros/does-not-exist",
                 headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 404
