"""Agent flow CRUD integration tests."""

import pytest
from httpx import AsyncClient


async def _register_and_token(client: AsyncClient, email: str) -> str:
    resp = await client.post(
        "/v1/auth/register",
        json={"email": email, "full_name": "Flow User", "password": "securepass123"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_flow_crud_lifecycle(client: AsyncClient):
    token = await _register_and_token(client, "flow_crud@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post(
        "/v1/flows",
        headers=headers,
        json={
            "name": "My Pipeline",
            "description": "Test flow",
            "graph": {
                "nodes": [{"id": "n1", "type": "start", "position": {"x": 0, "y": 0}, "data": {}}],
                "edges": [],
                "version": "1.0",
            },
        },
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    flow_id = created["id"]
    assert created["name"] == "My Pipeline"
    assert created["node_count"] == 1

    list_resp = await client.get("/v1/flows", headers=headers)
    assert list_resp.status_code == 200
    assert any(f["id"] == flow_id for f in list_resp.json())

    patch_resp = await client.patch(
        f"/v1/flows/{flow_id}",
        headers=headers,
        json={"name": "Renamed Pipeline"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Renamed Pipeline"

    dup_resp = await client.post(f"/v1/flows/{flow_id}/duplicate", headers=headers)
    assert dup_resp.status_code == 201
    assert dup_resp.json()["name"] == "Renamed Pipeline (copy)"

    del_resp = await client.delete(f"/v1/flows/{flow_id}", headers=headers)
    assert del_resp.status_code == 204

    gone = await client.get(f"/v1/flows/{flow_id}", headers=headers)
    assert gone.status_code == 404


@pytest.mark.asyncio
async def test_flow_ownership_isolated(client: AsyncClient):
    owner_token = await _register_and_token(client, "flow_owner@example.com")
    other_token = await _register_and_token(client, "flow_other@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    other_headers = {"Authorization": f"Bearer {other_token}"}

    create_resp = await client.post(
        "/v1/flows",
        headers=owner_headers,
        json={"name": "Private Flow"},
    )
    flow_id = create_resp.json()["id"]

    other_get = await client.get(f"/v1/flows/{flow_id}", headers=other_headers)
    assert other_get.status_code == 404

    other_del = await client.delete(f"/v1/flows/{flow_id}", headers=other_headers)
    assert other_del.status_code == 404
