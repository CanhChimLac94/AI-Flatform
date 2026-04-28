"""
STEP 6.1 — Telegram Webhook Gateway.
Ref: FR-07, US05, AiChat-SRS-Main §3.3

Supported commands (US05 AC3):
  /start          → welcome + linking instructions
  /link {CODE}    → link Telegram account to web account
  /newchat        → create a new conversation
  /summary        → summarise the current conversation (stub for Phase 2 extension)
  /mode auto|speed|quality → change routing preference for this session
  <text>          → forward to orchestrator, stream reply back to Telegram
"""

import hashlib
import hmac
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.conversation import Conversation
from app.models.message import MessageRole
from app.repositories.conversation import ConversationRepository
from app.repositories.message import MessageRepository
from app.repositories.user import UserRepository
from app.schemas.chat import ChatCompletionRequest, MessageIn
from app.services.moderation import ModerationError, check_content, REFUSAL_MESSAGE
from app.services.orchestrator import stream_chat_completion
from app.services.quota import increment_tokens, is_quota_exceeded
from app.services.telegram import (
    generate_link_code,
    resolve_link_code,
    send_message,
    stream_reply_to_telegram,
)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Per-session model preference stored in Redis key: tg_mode:{telegram_id}
_MODE_KEY = "tg_mode:{}"
_ACTIVE_CONV_KEY = "tg_conv:{}"


def _verify_telegram_token(secret_token: str | None) -> bool:
    """Telegram sends X-Telegram-Bot-Api-Secret-Token when configured."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return False
    expected = hmac.new(
        key=b"WebAppData",
        msg=settings.TELEGRAM_BOT_TOKEN.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(secret_token or "", expected)


async def _get_or_create_conv(user_id, tg_id: int, db: AsyncSession) -> Conversation:
    from app.db.redis import get_redis
    redis = get_redis()
    conv_id = await redis.get(_ACTIVE_CONV_KEY.format(tg_id))
    repo = ConversationRepository(db)
    if conv_id:
        conv = await repo.get(conv_id)
        if conv and conv.user_id == user_id:
            return conv
    conv = await repo.create(user_id=user_id)
    await db.commit()
    await redis.set(_ACTIVE_CONV_KEY.format(tg_id), str(conv.id), ex=86400)
    return conv


async def _handle_update(update: dict[str, Any]) -> None:
    """Background task — processes one Telegram update asynchronously."""
    message = update.get("message") or update.get("edited_message")
    if not message:
        return

    chat_id: int = message["chat"]["id"]
    telegram_id: int = message["from"]["id"]
    telegram_username: str = message["from"].get("username", "")
    text: str = (message.get("text") or "").strip()

    if not text:
        return

    async with AsyncSessionLocal() as db:
        from app.db.redis import get_redis
        redis = get_redis()

        # ── /start ───────────────────────────────────────────────────────────
        if text == "/start":
            await send_message(
                chat_id,
                "👋 *Welcome to Omni AI Chat!*\n\n"
                "To link your account, visit the web app and generate a code "
                "under Settings → Integrations, then send:\n"
                "`/link YOUR_CODE`\n\n"
                "Commands: /newchat · /summary · /mode auto|speed|quality",
            )
            return

        # ── /link {CODE} ──────────────────────────────────────────────────────
        if text.startswith("/link "):
            code = text.split(" ", 1)[1].strip()
            user_id = await resolve_link_code(code)
            if not user_id:
                await send_message(chat_id, "❌ Code expired or invalid. Please generate a new one.")
                return
            user_repo = UserRepository(db)
            user = await user_repo.get(user_id)
            if user:
                user.telegram_id = telegram_id
                user.telegram_username = telegram_username
                await db.commit()
                await send_message(chat_id, f"✅ Account linked! Welcome, {user.full_name or user.email}.")
            return

        # ── Resolve user ──────────────────────────────────────────────────────
        user = await UserRepository(db).get_by_telegram_id(telegram_id)
        if not user:
            await send_message(
                chat_id,
                "🔗 Please link your account first using `/link YOUR_CODE`.\n"
                "Get a code from the web app under Settings → Integrations.",
            )
            return

        # ── /newchat ──────────────────────────────────────────────────────────
        if text == "/newchat":
            await redis.delete(_ACTIVE_CONV_KEY.format(telegram_id))
            await send_message(chat_id, "✅ New conversation started.")
            return

        # ── /summary ──────────────────────────────────────────────────────────
        if text == "/summary":
            await send_message(chat_id, "📝 Summary feature coming soon in Phase 4.2 extension.")
            return

        # ── /mode ─────────────────────────────────────────────────────────────
        if text.startswith("/mode"):
            parts = text.split()
            mode = parts[1].lower() if len(parts) > 1 else "auto"
            if mode not in ("auto", "speed", "quality"):
                await send_message(chat_id, "Usage: /mode auto | speed | quality")
                return
            await redis.set(_MODE_KEY.format(telegram_id), mode, ex=86400)
            await send_message(chat_id, f"✅ Model mode set to *{mode}*.")
            return

        # ── Quota check ───────────────────────────────────────────────────────
        if await is_quota_exceeded(user.id, db):
            await send_message(chat_id, "⚠️ Daily token quota exhausted. Try again tomorrow.")
            return

        # ── Moderation (EX-02) ────────────────────────────────────────────────
        try:
            await check_content(text)
        except ModerationError:
            await send_message(chat_id, REFUSAL_MESSAGE)
            return

        # ── Build request + stream ─────────────────────────────────────────────
        mode_raw = await redis.get(_MODE_KEY.format(telegram_id)) or "auto"
        conv = await _get_or_create_conv(user.id, telegram_id, db)

        msg_repo = MessageRepository(db)
        await msg_repo.create_message(conv_id=conv.id, role=MessageRole.user, content=text)
        await db.commit()

        req = ChatCompletionRequest(
            conversation_id=str(conv.id),
            model_preference=mode_raw,
            messages=[MessageIn(role="user", content=text)],
            stream=True,
        )
        system_prompt = (
            f"You are a helpful AI assistant replying via Telegram. "
            f"The user's name is {user.full_name or 'there'}. "
            f"Keep responses concise since this is a messaging interface. "
            f"Respond in the same language the user uses."
        )

        generator = stream_chat_completion(req, system_prompt, user_id=user.id, db=db)
        await stream_reply_to_telegram(chat_id, generator)

        # Increment quota (tokens counted inside stream_reply_to_telegram via done event)
        # Full token tracking done via increment_tokens inside the SSE generator


@router.post("/telegram")
async def telegram_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    # In production, verify the secret token set when registering the webhook
    # Skipped in dev when token is not configured
    if settings.ENVIRONMENT != "development" and not _verify_telegram_token(
        x_telegram_bot_api_secret_token
    ):
        raise HTTPException(status_code=403, detail="Invalid webhook token")

    update = await request.json()
    background_tasks.add_task(_handle_update, update)
    return {"ok": True}
