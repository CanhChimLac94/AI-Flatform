"""
STEP 4.3 — Web Search Tool via Tavily API.
Ref: FR-03, US03, AiChat-UIUX-Wireframe §III Step 1

Returns formatted context string + structured citations to inject into the LLM prompt.
Caller streams a "citations" SSE event before the content stream (US03 AC2).
"""

from dataclasses import dataclass

import asyncio
from functools import partial

try:
    from tavily import AsyncTavilyClient as _AsyncTavilyClient
    _HAS_ASYNC_CLIENT = True
except ImportError:
    _HAS_ASYNC_CLIENT = False

from tavily import TavilyClient

from app.core.config import settings
from app.schemas.chat import SSECitation


@dataclass
class SearchResult:
    context: str                    # Formatted text injected into system prompt
    citations: list[SSECitation]    # Sent to client as SSE citations event


class SearchUnavailableError(Exception):
    """Raised when Tavily is unreachable — caller falls back with a notice (US03 AC3)."""
    pass


async def web_search(query: str, max_results: int = 5) -> SearchResult:
    """
    Executes a Tavily web search and returns injected context + citations.
    Raises SearchUnavailableError on any network / auth failure (US03 AC3).
    """
    if not settings.TAVILY_API_KEY or settings.TAVILY_API_KEY == "tvly-...":
        raise SearchUnavailableError("TAVILY_API_KEY not configured")

    try:
        if _HAS_ASYNC_CLIENT:
            client = _AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)
            response = await client.search(
                query=query,
                max_results=max_results,
                include_answer=True,
                include_raw_content=False,
            )
        else:
            # Older tavily-python without AsyncTavilyClient — run sync client in thread
            sync_client = TavilyClient(api_key=settings.TAVILY_API_KEY)
            search_fn = partial(
                sync_client.search,
                query=query,
                max_results=max_results,
                include_answer=True,
                include_raw_content=False,
            )
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, search_fn)
    except Exception as exc:
        raise SearchUnavailableError(str(exc)) from exc

    results = response.get("results", [])
    citations: list[SSECitation] = []
    snippets: list[str] = []

    for idx, r in enumerate(results, start=1):
        url = r.get("url", "")
        title = r.get("title", url)
        content = r.get("content", "")
        citations.append(SSECitation(id=idx, url=url, title=title))
        snippets.append(f"[{idx}] {title}\n{content}")

    # Prepend Tavily's synthesized answer if available
    answer = response.get("answer", "")
    if answer:
        snippets.insert(0, f"Summary: {answer}\n")

    context = (
        "--- Web Search Results (use these as your primary source) ---\n"
        + "\n\n".join(snippets)
        + "\n--- End of Search Results ---"
    )
    return SearchResult(context=context, citations=citations)
