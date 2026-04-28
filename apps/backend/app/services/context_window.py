"""
Sliding Window context management — EX-03.

When the conversation exceeds max_tokens, the oldest non-system messages are
dropped first so the most recent context is always preserved.
Approximation: 1 token ≈ 4 characters (fast, no tiktoken dependency).
"""

from app.schemas.chat import MessageIn

# Conservative limit — leaves headroom for the model's reply
DEFAULT_MAX_CONTEXT_TOKENS = 6_000


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def apply_sliding_window(
    messages: list[MessageIn],
    max_tokens: int = DEFAULT_MAX_CONTEXT_TOKENS,
) -> list[MessageIn]:
    """
    Returns a trimmed message list that fits within max_tokens.
    System messages are always preserved at the front.
    """
    system_msgs = [m for m in messages if m.role == "system"]
    non_system = [m for m in messages if m.role != "system"]

    system_tokens = sum(_estimate_tokens(m.content) for m in system_msgs)
    budget = max_tokens - system_tokens

    # Walk from newest to oldest, keeping messages that fit
    kept: list[MessageIn] = []
    used = 0
    for msg in reversed(non_system):
        cost = _estimate_tokens(msg.content)
        if used + cost > budget:
            break
        kept.append(msg)
        used += cost

    kept.reverse()
    return system_msgs + kept
