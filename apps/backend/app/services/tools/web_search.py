"""
Web Search Tool — Google Custom Search (primary) with Tavily fallback.
Ref: FR-03, US03

Returns formatted context string + structured citations to inject into the LLM prompt.
Caller streams a "citations" SSE event before the content stream (US03 AC2).

Priority:
  1. Google Custom Search API  — requires GOOGLE_API_KEY + GOOGLE_CSE_ID
  2. Tavily API                — requires TAVILY_API_KEY (fallback)
"""

import asyncio
from dataclasses import dataclass
from functools import partial

import httpx

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
    """Raised when all search providers are unreachable (US03 AC3)."""
    pass


_GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"


async def _google_search(query: str, max_results: int = 5) -> SearchResult:
    """Search via Google Custom Search API."""
    params = {
        "key": settings.GOOGLE_API_KEY,
        "cx": settings.GOOGLE_CSE_ID,
        "q": query,
        "num": min(max_results, 10),
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(_GOOGLE_SEARCH_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    items = data.get("items", [])
    citations: list[SSECitation] = []
    snippets: list[str] = []

    for idx, item in enumerate(items, start=1):
        url = item.get("link", "")
        title = item.get("title", url)
        snippet = item.get("snippet", "")
        citations.append(SSECitation(id=idx, url=url, title=title))
        snippets.append(f"[{idx}] {title}\n{snippet}")

    context = (
        "--- Kết quả tìm kiếm từ Google (dùng làm nguồn chính để tổng hợp) ---\n"
        + "\n\n".join(snippets)
        + "\n--- Hết kết quả tìm kiếm ---"
    )
    return SearchResult(context=context, citations=citations)


async def _tavily_search(query: str, max_results: int = 5) -> SearchResult:
    """Search via Tavily API (fallback)."""
    if _HAS_ASYNC_CLIENT:
        client = _AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)
        response = await client.search(
            query=query,
            max_results=max_results,
            include_answer=True,
            include_raw_content=False,
        )
    else:
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

    results = response.get("results", [])
    citations: list[SSECitation] = []
    snippets: list[str] = []

    for idx, r in enumerate(results, start=1):
        url = r.get("url", "")
        title = r.get("title", url)
        content = r.get("content", "")
        citations.append(SSECitation(id=idx, url=url, title=title))
        snippets.append(f"[{idx}] {title}\n{content}")

    answer = response.get("answer", "")
    if answer:
        snippets.insert(0, f"Tóm tắt: {answer}\n")

    context = (
        "--- Kết quả tìm kiếm (dùng làm nguồn chính để tổng hợp) ---\n"
        + "\n\n".join(snippets)
        + "\n--- Hết kết quả tìm kiếm ---"
    )
    return SearchResult(context=context, citations=citations)


def _is_real_key(value: str) -> bool:
    """Return False for empty strings and obvious placeholder values ending with '...'"""
    return bool(value) and not value.endswith("...")


def search_available() -> bool:
    """Return True if at least one search provider has a real API key configured."""
    google_ready = _is_real_key(settings.GOOGLE_API_KEY) and _is_real_key(settings.GOOGLE_CSE_ID)
    tavily_ready = _is_real_key(settings.TAVILY_API_KEY)
    return google_ready or tavily_ready


async def web_search(query: str, max_results: int = 5) -> SearchResult:
    """
    Execute a web search and return injected context + citations.
    Tries Google Custom Search first, then falls back to Tavily.
    Raises SearchUnavailableError if no provider is configured or all fail.
    """
    google_ready = _is_real_key(settings.GOOGLE_API_KEY) and _is_real_key(settings.GOOGLE_CSE_ID)
    tavily_ready = _is_real_key(settings.TAVILY_API_KEY)

    if not google_ready and not tavily_ready:
        raise SearchUnavailableError("No search provider configured (set GOOGLE_API_KEY+GOOGLE_CSE_ID or TAVILY_API_KEY)")

    if google_ready:
        try:
            return await _google_search(query, max_results)
        except Exception as exc:
            if not tavily_ready:
                raise SearchUnavailableError(str(exc)) from exc
            # Fall through to Tavily

    try:
        return await _tavily_search(query, max_results)
    except Exception as exc:
        raise SearchUnavailableError(str(exc)) from exc
