"""
STEP 4.2 — Long-term Memory (RAG).
Ref: FR-05, FR-06, US04, AiChat-UIUX-Wireframe §III Step 2

Two entry points:
  extract_and_store_facts()  — background job after conversation ends (FR-05, US04 AC1-AC2)
  retrieve_memory_context()  — called at chat start to build system prompt injection (FR-06, US04 AC3)
"""

from uuid import UUID

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.repositories.memory import UserMemoryRepository

# ── Embedding model ───────────────────────────────────────────────────────────
# 1536 dimensions — matches Vector(1536) column in user_memories table

def _get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        api_key=settings.OPENAI_API_KEY,
        model="text-embedding-3-small",
    )


# ── Fact extraction chain (FR-05) ─────────────────────────────────────────────

_EXTRACT_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        """Extract concise, durable facts about the USER from the conversation.
Rules:
- Only facts directly stated by the user (name, job, preferences, goals, location, skills).
- Each fact on its own line, starting with "FACT:".
- Maximum 5 facts. Skip greetings, questions to the AI, and general knowledge.
- If no durable facts exist, output: NONE""",
    ),
    ("human", "Conversation:\n{conversation_text}"),
])


async def extract_and_store_facts(
    user_id: UUID,
    conversation_messages: list[dict],  # [{"role": ..., "content": ...}]
) -> int:
    """
    Background job: extract user facts and upsert into user_memories (US04 AC1-AC2).
    Returns the number of facts stored.
    """
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "sk-...":
        return 0

    lines = [
        f"{m['role'].upper()}: {m['content']}"
        for m in conversation_messages
        if m["role"] in ("user", "assistant")
    ]
    if not lines:
        return 0

    conversation_text = "\n".join(lines[:40])  # cap at 40 turns

    try:
        llm = ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            model="gpt-4o-mini",
            temperature=0,
        )
        chain = _EXTRACT_PROMPT | llm | StrOutputParser()
        raw_output: str = await chain.ainvoke({"conversation_text": conversation_text})
    except Exception:
        return 0

    if raw_output.strip() == "NONE":
        return 0

    facts = [
        line.removeprefix("FACT:").strip()
        for line in raw_output.splitlines()
        if line.strip().startswith("FACT:")
    ]
    if not facts:
        return 0

    embeddings_model = _get_embeddings()
    stored = 0

    async with AsyncSessionLocal() as db:
        repo = UserMemoryRepository(db)
        for fact in facts:
            try:
                embedding = await embeddings_model.aembed_query(fact)
                await repo.upsert_fact(
                    user_id=user_id,
                    fact_content=fact,
                    embedding=embedding,
                    importance_score=0.7,
                )
                stored += 1
            except Exception:
                continue
        await db.commit()

    return stored


# ── Context retrieval (FR-06) ─────────────────────────────────────────────────

async def retrieve_memory_context(
    user_id: UUID,
    query: str,
    db: AsyncSession,
    top_k: int = 5,
) -> str:
    """
    Retrieves the most relevant user memories for the current query using cosine
    similarity on pgvector. Returns a formatted string ready to append to the
    system prompt (US04 AC3, AiChat-UIUX-Wireframe §III Step 2).
    """
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "sk-...":
        return ""

    try:
        embeddings_model = _get_embeddings()
        query_embedding = await embeddings_model.aembed_query(query)

        repo = UserMemoryRepository(db)
        memories = await repo.find_similar(
            user_id=user_id,
            query_embedding=query_embedding,
            top_k=top_k,
            min_importance=0.3,
        )
    except Exception:
        return ""

    if not memories:
        return ""

    facts_text = "\n".join(f"- {m.fact_content}" for m in memories)
    return (
        f"\n\n[Long-term memory about this user — use naturally, don't quote directly]\n"
        f"{facts_text}"
    )
