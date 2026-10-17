"""LangGraph flow that searches recent news/video sources for an NSE company."""

import asyncio
from functools import lru_cache
import time
from typing import TypedDict
from datetime import datetime, timezone

from langgraph.graph import END, START, StateGraph

from app.ai.agents.catalyst_agent import summarize_stock_catalysts
from app.ai.catalyst_schemas import (
    CatalystBrief,
    CatalystSource,
    StockCatalystRequest,
    StockCatalystResponse,
)
from app.ai.sources.news_search import search_stock_news
from app.ai.sources.youtube_search import search_stock_videos
from app.core.flow_logger import log_flow_event, new_flow_id


_CACHE_TTL_SECONDS = 15 * 60
_cache: dict[tuple[str, str], tuple[float, StockCatalystResponse]] = {}
_cache_lock = asyncio.Lock()


class StockCatalystState(TypedDict, total=False):
    symbol: str
    company_name: str | None
    flow_id: str
    news: list[CatalystSource]
    videos: list[CatalystSource]
    news_error: str | None
    videos_error: str | None
    brief: CatalystBrief
    summary_error: str | None


async def _run_source_search(search, *args):
    try:
        return await search(*args), None
    except Exception as exc:
        return [], f"{type(exc).__name__}: {str(exc)[:160]}"


async def search_sources_node(state: StockCatalystState) -> dict:
    symbol = state["symbol"]
    company_name = state.get("company_name")
    flow_id = state["flow_id"]
    log_flow_event(flow_id, "CATALYST SOURCE SEARCH", f"Searching recent news + YouTube for {symbol}")
    (news, news_error), (videos, videos_error) = await asyncio.gather(
        _run_source_search(search_stock_news, symbol, company_name),
        _run_source_search(search_stock_videos, symbol, company_name),
    )
    log_flow_event(
        flow_id,
        "CATALYST SOURCES READY",
        f"{len(news)} article links, {len(videos)} video links",
    )
    if news_error:
        log_flow_event(flow_id, "NEWS SEARCH UNAVAILABLE", news_error.split(":", 1)[0])
    if videos_error:
        log_flow_event(flow_id, "VIDEO SEARCH UNAVAILABLE", videos_error.split(":", 1)[0])
    return {
        "news": news,
        "videos": videos,
        "news_error": news_error,
        "videos_error": videos_error,
    }


async def summarize_sources_node(state: StockCatalystState) -> dict:
    news = state.get("news", [])
    videos = state.get("videos", [])
    if not news and not videos:
        unavailable = bool(state.get("news_error") or state.get("videos_error"))
        return {
            "brief": CatalystBrief(
                summary=(
                    "The source search is temporarily unavailable. Try searching again shortly."
                    if unavailable
                    else "No recent news articles or videos were found for this search."
                ),
                factors=[],
            ),
            "summary_error": None,
        }

    try:
        brief = await summarize_stock_catalysts(
            symbol=state["symbol"],
            company_name=state.get("company_name"),
            news=news,
            videos=videos,
        )
        return {"brief": brief, "summary_error": None}
    except Exception as exc:
        log_flow_event(state["flow_id"], "CATALYST SUMMARY UNAVAILABLE", type(exc).__name__)
        return {
            "brief": CatalystBrief(
                summary="Source links are available, but the AI summary is temporarily unavailable. Review the linked headlines and video titles.",
                factors=[],
            ),
            "summary_error": "AI summary is temporarily unavailable.",
        }


@lru_cache(maxsize=1)
def get_stock_catalyst_graph():
    workflow = StateGraph(StockCatalystState)
    workflow.add_node("search_sources", search_sources_node)
    workflow.add_node("summarize_sources", summarize_sources_node)
    workflow.add_edge(START, "search_sources")
    workflow.add_edge("search_sources", "summarize_sources")
    workflow.add_edge("summarize_sources", END)
    return workflow.compile()


async def research_stock_catalysts(
    request: StockCatalystRequest,
) -> StockCatalystResponse:
    cache_key = (request.symbol, (request.company_name or "").casefold())
    now = time.monotonic()
    if not request.refresh:
        async with _cache_lock:
            cached = _cache.get(cache_key)
            if cached and now - cached[0] < _CACHE_TTL_SECONDS:
                return cached[1].model_copy(update={"cached": True}, deep=True)

    flow_id = new_flow_id()
    result = await get_stock_catalyst_graph().ainvoke(
        {
            "symbol": request.symbol,
            "company_name": request.company_name,
            "flow_id": flow_id,
        }
    )
    response = StockCatalystResponse(
        symbol=request.symbol,
        company_name=request.company_name,
        retrieved_at=datetime.now(timezone.utc).isoformat(),
        news=result.get("news", []),
        videos=result.get("videos", []),
        brief=result["brief"],
        news_error=(
            "Recent news search is temporarily unavailable."
            if result.get("news_error")
            else None
        ),
        videos_error=(
            "YouTube search is temporarily unavailable."
            if result.get("videos_error")
            else None
        ),
        summary_error=result.get("summary_error"),
    )
    log_flow_event(flow_id, "CATALYST RESPONSE", f"Research ready for {request.symbol}")
    async with _cache_lock:
        _cache[cache_key] = (time.monotonic(), response)
    return response
