"""
STEP 6.1 — Telegram Bot service layer.
Ref: FR-07, US05, AiChat-SRS-Main §3.3

Handles:
  - Sending / editing messages via Bot API
  - Generating one-time account-link codes (stored in Redis, TTL 10 min)
  - Buffering the SSE stream and streaming back to Telegram via message edits
"""

import httpx

from app.core.config import settings
from app.db.redis import get_redis

_BOT_BASE = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"
_LINK_CODE_TTL = 600   # 10 minutes
_LINK_CODE_PREFIX = "tg_link:"


async def send_message(chat_id: int, text: str, parse_mode: str = "Markdown") -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{_BOT_BASE}/sendMessage", json={
            "chat_id": chat_id,
            "text": text[:4096],   # Telegram hard limit
            "parse_mode": parse_mode,
        })
        return r.json()


async def edit_message(chat_id: int, message_id: int, text: str) -> None:
    """Used to simulate streaming: edit an existing bot message with growing content."""
    async with httpx.AsyncClient() as client:
        await client.post(f"{_BOT_BASE}/editMessageText", json={
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text[:4096],
        })


# ── Account linking ───────────────────────────────────────────────────────────

async def generate_link_code(user_id: str) -> str:
    """Stores user_id under a 6-char code in Redis for 10 minutes (US05 AC1)."""
    import secrets
    redis = get_redis()
    code = secrets.token_hex(3).upper()   # e.g. "A3F7B2"
    await redis.set(f"{_LINK_CODE_PREFIX}{code}", user_id, ex=_LINK_CODE_TTL)
    return code


async def resolve_link_code(code: str) -> str | None:
    """Returns user_id and deletes the code (one-time use)."""
    redis = get_redis()
    key = f"{_LINK_CODE_PREFIX}{code.upper()}"
    user_id = await redis.get(key)
    if user_id:
        await redis.delete(key)
    return user_id


# ── Streaming to Telegram ─────────────────────────────────────────────────────

async def stream_reply_to_telegram(
    chat_id: int,
    sse_generator,
) -> None:
    """
    Consumes an orchestrator SSE generator and progressively edits a Telegram message
    so the user sees the response building up (simulated streaming — US05 AC2).
    """
    import json

    # Send placeholder to get message_id for edits
    sent = await send_message(chat_id, "⏳ Thinking…")
    message_id: int | None = sent.get("result", {}).get("message_id")

    accumulated = ""
    edit_threshold = 100   # Edit every ~100 new characters to avoid flood limits

    async for raw_sse in sse_generator:
        if not raw_sse.startswith("data: "):
            continue
        try:
            event = json.loads(raw_sse[6:].strip())
        except json.JSONDecodeError:
            continue

        etype = event.get("type")
        if etype == "content":
            accumulated += event.get("delta", "")
            if message_id and len(accumulated) % edit_threshold < 5:
                await edit_message(chat_id, message_id, accumulated)
        elif etype == "done":
            if message_id and accumulated:
                await edit_message(chat_id, message_id, accumulated)
            return
        elif etype == "error":
            await send_message(chat_id, f"❌ {event.get('message', 'Error')}")
            return

    if accumulated and message_id:
        await edit_message(chat_id, message_id, accumulated)
