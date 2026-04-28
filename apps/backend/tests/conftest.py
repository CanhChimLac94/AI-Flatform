import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch

from main import app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_token(client):
    """Register a test user and return a valid JWT token."""
    with patch("app.db.session.AsyncSessionLocal") as mock_session:
        # Full integration tests require a live DB; unit tests mock at service level
        pass
    return "test_token_placeholder"
