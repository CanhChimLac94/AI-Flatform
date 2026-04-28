"""
UserMemory repository with pgvector ANN similarity search.
Ref: AiChat-Database-Schema.md Group C, FR-06
"""

from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.memory import UserMemory
from app.repositories.base import BaseRepository


class UserMemoryRepository(BaseRepository[UserMemory]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(UserMemory, session)

    async def find_similar(
        self,
        user_id: UUID,
        query_embedding: list[float],
        top_k: int = 5,
        min_importance: float = 0.0,
    ) -> list[UserMemory]:
        """
        Cosine ANN search using the HNSW index created in init.sql.
        Returns top_k memories ordered by similarity (most similar first).
        """
        result = await self.session.execute(
            select(UserMemory)
            .where(
                UserMemory.user_id == user_id,
                UserMemory.embedding.is_not(None),
                UserMemory.importance_score >= min_importance,
            )
            .order_by(
                UserMemory.embedding.cosine_distance(query_embedding)
            )
            .limit(top_k)
        )
        return list(result.scalars().all())

    async def list_for_user(self, user_id: UUID) -> list[UserMemory]:
        result = await self.session.execute(
            select(UserMemory)
            .where(UserMemory.user_id == user_id)
            .order_by(UserMemory.importance_score.desc())
        )
        return list(result.scalars().all())

    async def upsert_fact(
        self,
        user_id: UUID,
        fact_content: str,
        embedding: list[float],
        importance_score: float = 0.5,
    ) -> UserMemory:
        """
        If a very similar fact already exists (cosine distance < 0.15),
        update it with newer content (EC-03 — contradictory memory resolution).
        Otherwise create a new record.
        """
        existing = await self.find_similar(
            user_id, embedding, top_k=1, min_importance=0.0
        )
        if existing:
            # Check distance threshold — pgvector cosine_distance returns 0..2
            candidate = existing[0]
            distance_row = await self.session.execute(
                text(
                    "SELECT embedding <=> :emb AS dist FROM user_memories WHERE id = :id"
                ),
                {"emb": str(embedding), "id": str(candidate.id)},
            )
            dist = distance_row.scalar_one_or_none()
            if dist is not None and dist < 0.15:
                candidate.fact_content = fact_content
                candidate.embedding = embedding
                candidate.importance_score = max(candidate.importance_score, importance_score)
                await self.session.flush()
                return candidate

        return await self.create(
            user_id=user_id,
            fact_content=fact_content,
            embedding=embedding,
            importance_score=importance_score,
        )
