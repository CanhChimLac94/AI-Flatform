"""Auth refresh token flow tests."""

import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_refresh_after_login(client: AsyncClient):
    email = "refresh_test@example.com"
    password = "securepass123"

    reg = await client.post(
        "/v1/auth/register",
        json={"email": email, "full_name": "Refresh Test", "password": password},
    )
    assert reg.status_code == 201
    assert "access_token" in reg.json()
    assert client.cookies.get("omni_refresh")

    refresh = await client.post("/v1/auth/refresh")
    assert refresh.status_code == 200
    assert "access_token" in refresh.json()
    new_token = refresh.json()["access_token"]

    me = await client.get("/v1/auth/me", headers={"Authorization": f"Bearer {new_token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email


@pytest.mark.asyncio
async def test_logout_clears_refresh(client: AsyncClient):
    email = "logout_test@example.com"
    await client.post(
        "/v1/auth/register",
        json={"email": email, "full_name": "Logout Test", "password": "securepass123"},
    )
    assert client.cookies.get("omni_refresh")

    logout = await client.post("/v1/auth/logout")
    assert logout.status_code == 204

    refresh = await client.post("/v1/auth/refresh")
    assert refresh.status_code == 401
