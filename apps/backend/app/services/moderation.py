"""
Safety filter — EX-02 / EC-04.
Runs BEFORE routing to any LLM. Uses OpenAI moderation endpoint (free, fast).
If flagged → raises ModerationError; caller returns refusal response.
"""

from openai import AsyncOpenAI

from app.core.config import settings

REFUSAL_MESSAGE = (
    "Tôi không thể hỗ trợ yêu cầu này vì vi phạm chính sách an toàn."
)


class ModerationError(Exception):
    pass


async def check_content(text: str) -> None:
    """Raises ModerationError if content violates safety policy."""
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "sk-...":
        return  # Skip in dev when no key is configured

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.moderations.create(input=text)
    result = response.results[0]

    if result.flagged:
        categories = [k for k, v in result.categories.model_dump().items() if v]
        raise ModerationError(f"Content flagged: {', '.join(categories)}")
