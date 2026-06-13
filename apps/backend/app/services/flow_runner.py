"""Execute agent flow graphs (DAG walk with LLM agent nodes)."""

from __future__ import annotations

import logging
from collections import defaultdict, deque
from datetime import datetime, timezone
from uuid import UUID

from groq import AsyncGroq
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.agent_flow import AgentFlow
from app.models.agent_flow_schedule import AgentFlowRun
from app.models.user import User
from app.services.orchestrator import PROVIDER_MODELS, _GROQ_MODEL_ALIASES
from app.services.user_keys import get_all_effective_keys

logger = logging.getLogger(__name__)


def _topological_order(nodes: list[dict], edges: list[dict]) -> list[str]:
    node_ids = {str(n.get("id")) for n in nodes if n.get("id")}
    in_degree = {nid: 0 for nid in node_ids}
    adjacency: dict[str, list[str]] = defaultdict(list)

    for edge in edges:
        source = str(edge.get("source", ""))
        target = str(edge.get("target", ""))
        if source not in node_ids or target not in node_ids:
            continue
        adjacency[source].append(target)
        in_degree[target] += 1

    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    order: list[str] = []
    while queue:
        current = queue.popleft()
        order.append(current)
        for nxt in adjacency[current]:
            in_degree[nxt] -= 1
            if in_degree[nxt] == 0:
                queue.append(nxt)

    if len(order) != len(node_ids):
        raise ValueError("Flow graph contains a cycle or disconnected nodes")
    return order


async def _resolve_agent_prompt(session: AsyncSession, node_data: dict) -> str:
    prompt = str(node_data.get("prompt") or "").strip()
    agent_id = node_data.get("agentId")
    if agent_id:
        try:
            agent = await session.get(Agent, UUID(str(agent_id)))
            if agent and agent.system_prompt:
                base = agent.system_prompt.strip()
                return f"{base}\n\n{prompt}".strip() if prompt else base
        except (ValueError, TypeError):
            pass
    return prompt or "You are a helpful AI assistant."


async def _call_llm(
    *,
    system_prompt: str,
    user_input: str,
    provider: str,
    model: str | None,
    api_key: str,
) -> str:
    if not api_key:
        raise RuntimeError(f"No API key configured for provider '{provider}'")

    resolved_model = model or PROVIDER_MODELS.get(provider, "llama-3.3-70b-versatile")
    if provider == "groq":
        resolved_model = _GROQ_MODEL_ALIASES.get(resolved_model, resolved_model)
        client = AsyncGroq(api_key=api_key)
        response = await client.chat.completions.create(
            model=resolved_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input},
            ],
            temperature=0.4,
            max_tokens=4096,
        )
        return (response.choices[0].message.content or "").strip()

    raise RuntimeError(f"Scheduled flow execution currently supports groq only (got '{provider}')")


async def execute_flow(
    session: AsyncSession,
    flow: AgentFlow,
    *,
    owner: User,
    trigger: str = "schedule",
    schedule_id: UUID | None = None,
) -> AgentFlowRun:
    """Run a flow graph and persist results on the flow + run record."""
    graph = flow.graph if isinstance(flow.graph, dict) else {}
    nodes: list[dict] = graph.get("nodes") or []
    edges: list[dict] = graph.get("edges") or []

    run = AgentFlowRun(
        flow_id=flow.id,
        schedule_id=schedule_id,
        owner_user_id=owner.id,
        trigger=trigger,
        status="running",
    )
    session.add(run)
    await session.flush()

    node_map = {str(n.get("id")): n for n in nodes if n.get("id")}
    outputs: dict[str, str] = {}
    final_outputs: dict[str, str] = {}

    try:
        order = _topological_order(nodes, edges)
        predecessors: dict[str, list[str]] = defaultdict(list)
        for edge in edges:
            source = str(edge.get("source", ""))
            target = str(edge.get("target", ""))
            if source in node_map and target in node_map:
                predecessors[target].append(source)

        keys = await get_all_effective_keys(owner.id, session)
        provider = owner.default_provider or "groq"
        api_key = keys.get(provider, "")

        context = ""
        for node_id in order:
            node = node_map[node_id]
            node_type = node.get("type")
            data = node.get("data") or {}

            if node_type == "start":
                context = str(data.get("value") or data.get("label") or "").strip()
                outputs[node_id] = context
                data = {**data, "status": "success"}

            elif node_type == "agent":
                upstream = "\n\n".join(outputs[p] for p in predecessors.get(node_id, []) if outputs.get(p))
                user_input = upstream or context
                system_prompt = await _resolve_agent_prompt(session, data)
                model = data.get("model")
                if isinstance(model, str) and model.lower() in {"gemini", "claude", "gpt-4o"}:
                    model = None
                result = await _call_llm(
                    system_prompt=system_prompt,
                    user_input=user_input or "Proceed with the task.",
                    provider=provider,
                    model=str(model) if model else None,
                    api_key=api_key,
                )
                context = result
                outputs[node_id] = result
                data = {**data, "status": "success"}

            elif node_type == "output":
                upstream = "\n\n".join(outputs[p] for p in predecessors.get(node_id, []) if outputs.get(p))
                value = upstream or context
                outputs[node_id] = value
                final_outputs[str(data.get("label") or node_id)] = value
                data = {**data, "status": "success", "value": value}

            node["data"] = data

        flow.graph = {"nodes": nodes, "edges": edges, "version": graph.get("version", "1.0")}
        run.status = "success"
        run.result = {"outputs": final_outputs, "node_outputs": outputs}
        run.finished_at = datetime.now(timezone.utc)
        await session.flush()
        return run

    except Exception as exc:
        logger.exception("Flow execution failed for flow %s", flow.id)
        run.status = "failed"
        run.error_message = str(exc)
        run.finished_at = datetime.now(timezone.utc)
        await session.flush()
        raise
