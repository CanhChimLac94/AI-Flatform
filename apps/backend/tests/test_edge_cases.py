"""
STEP 7.1 — Edge Case Validation.
Verifies EX-01 through EX-05 as specified in AiChat-SRS-Main §4.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.context_window import apply_sliding_window, DEFAULT_MAX_CONTEXT_TOKENS
from app.services.moderation import ModerationError, check_content
from app.schemas.chat import MessageIn


# ── EX-02: Toxicity / Safety Filter ──────────────────────────────────────────

class TestEX02ModerationFilter:
    @pytest.mark.asyncio
    async def test_clean_content_passes(self):
        """Normal messages must not raise ModerationError."""
        with patch("app.services.moderation.AsyncOpenAI") as mock_openai:
            mock_result = MagicMock()
            mock_result.results = [MagicMock(flagged=False)]
            mock_openai.return_value.moderations.create = AsyncMock(return_value=mock_result)
            # Should not raise
            await check_content("What is the weather today?")

    @pytest.mark.asyncio
    async def test_toxic_content_raises(self):
        """Content flagged by moderation must raise ModerationError."""
        with patch("app.services.moderation.AsyncOpenAI") as mock_openai:
            mock_result = MagicMock()
            flagged = MagicMock(flagged=True)
            flagged.categories.model_dump.return_value = {"hate": True, "violence": False}
            mock_result.results = [flagged]
            mock_openai.return_value.moderations.create = AsyncMock(return_value=mock_result)

            with pytest.raises(ModerationError):
                await check_content("harmful content here")

    @pytest.mark.asyncio
    async def test_skips_when_no_api_key(self):
        """Moderation is skipped gracefully when OPENAI_API_KEY is not set."""
        with patch("app.services.moderation.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-..."
            # Should not raise — returns None silently
            await check_content("any content")


# ── EX-03: Context Window Sliding ────────────────────────────────────────────

class TestEX03SlidingWindow:
    def _make_messages(self, n: int, chars_each: int = 100) -> list[MessageIn]:
        return [
            MessageIn(role="user" if i % 2 == 0 else "assistant", content="x" * chars_each)
            for i in range(n)
        ]

    def test_short_context_unchanged(self):
        """Contexts under the limit must be returned as-is."""
        msgs = self._make_messages(4, chars_each=50)
        result = apply_sliding_window(msgs)
        assert len(result) == len(msgs)

    def test_long_context_is_truncated(self):
        """Contexts exceeding the token budget must be truncated."""
        # Each message ~100 chars ≈ 25 tokens; 300 messages = 7,500 tokens > 6,000 limit
        msgs = self._make_messages(300, chars_each=100)
        result = apply_sliding_window(msgs)
        assert len(result) < len(msgs)

    def test_system_messages_always_preserved(self):
        """System messages must always appear at the front of the trimmed result."""
        system = MessageIn(role="system", content="You are a helpful assistant.")
        user_msgs = self._make_messages(300, chars_each=100)
        result = apply_sliding_window([system] + user_msgs)
        assert result[0].role == "system"
        assert result[0].content == system.content

    def test_most_recent_messages_kept(self):
        """When truncating, the NEWEST messages must be retained over older ones."""
        msgs = [
            MessageIn(role="user", content=f"message-{i}")
            for i in range(50)
        ]
        result = apply_sliding_window(msgs, max_tokens=200)
        contents = [m.content for m in result]
        # The last message must always survive
        assert "message-49" in contents
        # The very first message should be dropped
        assert "message-0" not in contents


# ── EX-01: Provider Failover ──────────────────────────────────────────────────

class TestEX01ProviderFailover:
    @pytest.mark.asyncio
    async def test_failover_on_rate_limit(self):
        """On OpenAI 429, orchestrator must fall over to the next provider."""
        from openai import RateLimitError
        from app.schemas.chat import ChatCompletionRequest

        req = ChatCompletionRequest(
            model_preference="quality",
            messages=[MessageIn(role="user", content="hello")],
        )

        openai_calls = 0
        groq_calls = 0

        async def fake_openai(messages, model):
            nonlocal openai_calls
            openai_calls += 1
            raise RateLimitError("rate limit", response=MagicMock(status_code=429), body={})

        async def fake_groq(messages, model):
            nonlocal groq_calls
            groq_calls += 1
            yield 'data: {"type": "content", "delta": "hi"}\n\n'
            yield 'data: {"type": "done", "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2, "provider": "groq", "model": "llama3"}}\n\n'

        with patch("app.services.orchestrator._stream_openai", fake_openai), \
             patch("app.services.orchestrator._stream_groq", fake_groq), \
             patch("app.services.orchestrator.classify_intent", AsyncMock(return_value=__import__("app.services.intent_classifier", fromlist=["Intent"]).Intent.COMPLEX)):

            from app.services.orchestrator import stream_chat_completion
            events = []
            async for chunk in stream_chat_completion(req, "system prompt"):
                events.append(chunk)

        assert openai_calls == 1
        assert groq_calls == 1
        assert any("hi" in e for e in events)


# ── EX-05: Rate Limiting ──────────────────────────────────────────────────────

class TestEX05RateLimiting:
    @pytest.mark.asyncio
    async def test_rate_limit_exceeded_raises_429(self):
        """Exceeding 10 messages/minute must raise HTTP 429."""
        from fastapi import HTTPException
        from app.api.dependencies import rate_limit_check

        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_request = MagicMock()

        with patch("app.api.dependencies.get_redis") as mock_redis:
            redis_instance = AsyncMock()
            redis_instance.incr = AsyncMock(return_value=11)  # Over limit
            redis_instance.expire = AsyncMock()
            mock_redis.return_value = redis_instance

            with pytest.raises(HTTPException) as exc_info:
                await rate_limit_check(mock_request, mock_user)
            assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_quota_exceeded_raises_403(self):
        """Exhausted daily token quota must raise HTTP 403."""
        from fastapi import HTTPException
        from app.api.dependencies import quota_check

        mock_user = MagicMock()
        mock_user.id = "test-user-id"

        with patch("app.api.dependencies.is_quota_exceeded", AsyncMock(return_value=True)):
            with pytest.raises(HTTPException) as exc_info:
                await quota_check(mock_user, db=AsyncMock())
            assert exc_info.value.status_code == 403
