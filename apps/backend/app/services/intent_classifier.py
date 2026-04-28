"""
STEP 4.1 — Smart Model Routing via LangChain intent classification.
Ref: AiChat-UIUX-Wireframe §III Step 1, US06

Uses Groq Llama3 (fastest/cheapest) to classify intent before routing.
Returns an IntentResult that the orchestrator uses to pick provider + tools.
"""

from enum import Enum

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.core.config import settings


class Intent(str, Enum):
    CHATTER = "CHATTER"        # small talk / simple Q&A  → Groq (US06 AC1)
    COMPLEX = "COMPLEX"        # reasoning, code, analysis → GPT-4o / Claude (US06 AC2)
    WEB_SEARCH = "WEB_SEARCH"  # needs live data           → search tool + LLM (FR-03, US03)
    FILE_ANALYSIS = "FILE_ANALYSIS"  # attachments present → vision model (FR-01)


_CLASSIFIER_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        """You are an intent classifier for an AI chat router.
Classify the user message into EXACTLY ONE of these labels:
- CHATTER     : greetings, small talk, simple factual Q&A (< 50 words, no live data needed)
- WEB_SEARCH  : needs current/real-time information (news, prices, weather, recent events)
- COMPLEX     : coding, deep analysis, mathematics, document review, multi-step reasoning
- FILE_ANALYSIS : the user is asking about an attached file or image

Reply with ONLY the label, nothing else.""",
    ),
    ("human", "{user_message}"),
])


async def classify_intent(user_message: str, has_attachments: bool = False) -> Intent:
    """
    Classifies the user's intent. Falls back to COMPLEX on any error
    so we never accidentally under-serve a user with a fast/cheap model.
    """
    if has_attachments:
        return Intent.FILE_ANALYSIS

    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY == "gsk_...":
        # No key configured — fall back to word-count heuristic
        return Intent.CHATTER if len(user_message.split()) < 50 else Intent.COMPLEX

    try:
        llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model="llama-3.1-8b-instant",   # 8B is fast enough for classification
            temperature=0,
            max_tokens=10,
        )
        chain = _CLASSIFIER_PROMPT | llm | StrOutputParser()
        raw = await chain.ainvoke({"user_message": user_message[:500]})
        label = raw.strip().upper().split()[0]
        return Intent(label)
    except Exception:
        return Intent.COMPLEX   # Safe fallback


def intent_to_provider(intent: Intent) -> tuple[str, str]:
    """Maps intent → (provider, model) following US06 routing rules."""
    mapping = {
        Intent.CHATTER: ("groq", "llama-3.3-70b-versatile"),
        Intent.COMPLEX: ("openai", "gpt-4o"),
        Intent.WEB_SEARCH: ("openai", "gpt-4o"),      # web results injected as context
        Intent.FILE_ANALYSIS: ("openai", "gpt-4o"),   # vision-capable model
    }
    return mapping[intent]
