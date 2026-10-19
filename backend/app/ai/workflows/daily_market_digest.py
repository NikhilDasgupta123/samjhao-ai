"""Daily India market news digest powered by the shared Market Catalyst Agent."""

import asyncio
from datetime import datetime, timezone
import time
from zoneinfo import ZoneInfo

from app.ai.agents.catalyst_agent import summarize_daily_market_catalysts
from app.ai.catalyst_schemas import (
    CatalystBrief,
    DailyMarketDigestRequest,
    DailyMarketDigestResponse,
)
from app.ai.sources.news_search import search_india_market_news
from app.ai.sources.web_search import search_india_market_videos, search_india_market_web
from app.core.flow_logger import log_flow_event, new_flow_id


_CACHE_TTL_SECONDS = 60 * 60
_cache: tuple[str, float, DailyMarketDigestResponse] | None = None
_cache_lock = asyncio.Lock()
_INDIA_TZ = ZoneInfo("Asia/Kolkata")


async def _run_source_search(search):
    try:
        return await search(), None
    except Exception as exc:
        return [], f"{type(exc).__name__}: {str(exc)[:160]}"


async def research_daily_market_digest(
    request: DailyMarketDigestRequest,
) -> DailyMarketDigestResponse:
    global _cache
    as_of_date = datetime.now(_INDIA_TZ).date().isoformat()
    now = time.monotonic()
    if not request.refresh:
        async with _cache_lock:
            if _cache and _cache[0] == as_of_date and now - _cache[1] < _CACHE_TTL_SECONDS:
                return _cache[2].model_copy(update={"cached": True}, deep=True)

    flow_id = new_flow_id()
    log_flow_event(flow_id, "DAILY MARKET DIGEST", f"Searching India stock-market coverage for {as_of_date}")
    (news, news_error), (web, web_error), (videos, video_error) = await asyncio.gather(
        _run_source_search(search_india_market_news),
        _run_source_search(search_india_market_web),
        _run_source_search(search_india_market_videos),
    )
    all_sources = [*news, *web, *videos]
    log_flow_event(
        flow_id,
        "DAILY MARKET SOURCES READY",
        f"{len(news)} news links, {len(web)} web/social links, {len(videos)} YouTube videos",
    )

    summary_error = None
    if all_sources:
        try:
            brief = await summarize_daily_market_catalysts(
                as_of_date=as_of_date,
                news=news,
                web=web,
                videos=videos,
            )
        except Exception as exc:
            summary_error = "AI summary is temporarily unavailable."
            log_flow_event(flow_id, "DAILY DIGEST SUMMARY UNAVAILABLE", type(exc).__name__)
            brief = CatalystBrief(
                summary="Recent market sources are available below. The AI summary is temporarily unavailable.",
                factors=[],
            )
    else:
        unavailable = bool(news_error or web_error or video_error)
        brief = CatalystBrief(
            summary=(
                "Market news search is temporarily unavailable. Try refreshing shortly."
                if unavailable
                else "No recent India stock-market stories or videos were found. Try refreshing later."
            ),
            factors=[],
        )

    response = DailyMarketDigestResponse(
        as_of_date=as_of_date,
        retrieved_at=datetime.now(timezone.utc).isoformat(),
        news=news,
        web=web,
        videos=videos,
        brief=brief,
        news_error="News search is temporarily unavailable." if news_error else None,
        web_error="Web and social search is temporarily unavailable." if web_error else None,
        video_error="YouTube search is temporarily unavailable." if video_error else None,
        summary_error=summary_error,
    )
    async with _cache_lock:
        _cache = (as_of_date, time.monotonic(), response)
    return response
