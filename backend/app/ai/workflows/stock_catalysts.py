"""Stock catalyst entry point for the shared LangGraph workflow."""

import asyncio
from datetime import datetime, timezone
import time

from app.ai.catalyst_schemas import StockCatalystRequest, StockCatalystResponse
from app.ai.workflows.graph import get_workflow_graph
from app.core.flow_logger import log_flow_event, new_flow_id


_CACHE_TTL_SECONDS = 15 * 60
_cache: dict[tuple[str, str], tuple[float, StockCatalystResponse]] = {}
_cache_lock = asyncio.Lock()


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
    result = await get_workflow_graph().ainvoke(
        {
            "task": "catalysts",
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
        web=result.get("web", []),
        videos=result.get("videos", []),
        brief=result["catalyst_brief"],
        news_error=(
            "Recent news search is temporarily unavailable."
            if result.get("news_error")
            else None
        ),
        web_error=(
            "Public web and social search is temporarily unavailable."
            if result.get("web_error")
            else None
        ),
        video_error=(
            "Video search is temporarily unavailable."
            if result.get("video_error")
            else None
        ),
        summary_error=result.get("summary_error"),
    )
    log_flow_event(flow_id, "CATALYST RESPONSE", f"Research ready for {request.symbol}")
    async with _cache_lock:
        _cache[cache_key] = (time.monotonic(), response)
    return response
