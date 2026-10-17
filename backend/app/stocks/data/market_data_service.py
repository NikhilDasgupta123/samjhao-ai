"""Fetch normalized NSE market data through the local MCP tools."""

import asyncio
from datetime import date, datetime
import json
import time
from zoneinfo import ZoneInfo

from pydantic_ai.mcp import MCPToolset

from app.core.flow_logger import log_flow_event, new_flow_id
from app.stocks.data.nse_mcp_server import stock_data_mcp
from app.stocks.errors import StockDataUnavailableError
from app.stocks.schemas import (
    MarketWatchResponse,
    StockMarketDataRequest,
    StockMarketDataResponse,
)


stock_toolset = MCPToolset(stock_data_mcp)
market_watch_toolset = MCPToolset(stock_data_mcp)
_market_watch_lock = asyncio.Lock()
_market_watch_cache: tuple[float, dict] | None = None
_MARKET_WATCH_CACHE_SECONDS = 60


def read_mcp_result(response: dict) -> dict:
    """Decode structured MCP output and turn protocol errors into useful messages."""
    if response.get("isError"):
        messages = [
            item.get("text", "")
            for item in response.get("content", [])
            if isinstance(item, dict) and item.get("text")
        ]
        detail = "; ".join(messages) or "MCP stock data tool failed."
        raise RuntimeError(detail)

    structured = response.get("structuredContent")
    if isinstance(structured, dict):
        return structured

    for item in response.get("content", []):
        text = item.get("text") if isinstance(item, dict) else None
        if text:
            try:
                value = json.loads(text)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                return value
    raise RuntimeError("The stock MCP tool returned an unreadable response.")


def _latest_close_quote(symbol: str, history: dict) -> dict | None:
    points = [
        point
        for point in history.get("points") or []
        if point.get("close") is not None
    ]
    if not points:
        return None

    def date_key(point: dict) -> tuple[int, str]:
        value = str(point.get("date") or "")
        try:
            return (1, date.fromisoformat(value[:10]).isoformat())
        except ValueError:
            return (0, value)

    points.sort(key=date_key)

    latest = points[-1]
    previous_close = points[-2].get("close") if len(points) > 1 else None
    last_price = latest["close"]
    change = last_price - previous_close if previous_close is not None else None
    percent_change = (
        change / previous_close * 100
        if change is not None and previous_close
        else None
    )
    return {
        "symbol": symbol,
        "company_name": None,
        "last_price": last_price,
        "change": change,
        "percent_change": percent_change,
        "previous_close": previous_close,
        "open": latest.get("open"),
        "close": latest.get("close"),
        "vwap": None,
        "day_high": latest.get("high"),
        "day_low": latest.get("low"),
        "week_high": None,
        "week_low": None,
        "data_as_of": latest.get("date"),
        "source": "NSE daily history via jugaad-data (quote fallback)",
    }


async def _fetch_stock_market_data(
    symbol: str,
    history_days: int,
    flow_id: str,
) -> tuple[dict, dict]:
    log_flow_event(flow_id, "MCP CONNECTION", "Local NSE stock-data server is ready")
    log_flow_event(
        flow_id,
        "MCP TOOL CALL",
        f"get_nse_stock_history(symbol={symbol}, days={history_days})",
    )
    history_response = await stock_toolset.call_tool_for_app(
        "get_nse_stock_history",
        {"symbol": symbol, "days": history_days},
    )
    history = read_mcp_result(history_response)
    log_flow_event(flow_id, "MCP TOOL CALL", f"get_nse_stock_quote(symbol={symbol})")
    try:
        quote_response = await stock_toolset.call_tool_for_app(
            "get_nse_stock_quote", {"symbol": symbol}
        )
        quote = read_mcp_result(quote_response)
        log_flow_event(flow_id, "MCP TOOL RESULT", "Latest available NSE quote received")
    except Exception as exc:
        quote = _latest_close_quote(symbol, history)
        if quote is None:
            raise RuntimeError(
                f"NSE did not return a live quote or daily closing data for {symbol}."
            ) from exc
        log_flow_event(
            flow_id,
            "QUOTE FALLBACK",
            f"{type(exc).__name__}: {str(exc)[:90]}; using daily close from {quote['data_as_of']}",
        )
    log_flow_event(
        flow_id,
        "MCP DATA READY",
        f"Market data ready; {len(history.get('points') or [])} history points",
    )
    return quote, history


async def fetch_stock_market_data(
    symbol: str,
    history_days: int,
    flow_id: str,
    *,
    reuse_open_session: bool = False,
) -> tuple[dict, dict]:
    try:
        if reuse_open_session:
            return await _fetch_stock_market_data(symbol, history_days, flow_id)
        async with stock_toolset:
            return await _fetch_stock_market_data(symbol, history_days, flow_id)
    except Exception as exc:
        log_flow_event(
            flow_id,
            "MCP WORKFLOW FAILED",
            f"{type(exc).__name__}: {str(exc)[:160]}",
        )
        raise StockDataUnavailableError(
            f"Could not fetch NSE data for {symbol}. Confirm the NSE symbol and try again."
        ) from exc


async def get_stock_market_data(
    request: StockMarketDataRequest,
) -> StockMarketDataResponse:
    flow_id = new_flow_id()
    log_flow_event(
        flow_id,
        "REQUEST RECEIVED",
        f"Endpoint: POST /api/stocks/market-data | Symbol: {request.symbol}",
    )
    log_flow_event(
        flow_id,
        "MARKET DATA ROUTING",
        f"NSE:{request.symbol} → market data → NSE MCP tools",
    )
    quote, history = await fetch_stock_market_data(
        request.symbol, request.history_days, flow_id
    )
    retrieved_at = datetime.now(ZoneInfo("Asia/Kolkata"))
    log_flow_event(flow_id, "API RESPONSE", "NSE quote and price history are ready")
    return StockMarketDataResponse(
        symbol=request.symbol,
        retrieved_at=retrieved_at,
        quote=quote,
        history=history.get("points", []),
    )


async def get_nse_market_watch() -> MarketWatchResponse:
    """Return a shared, once-per-minute snapshot of NIFTY 500 constituents."""
    global _market_watch_cache
    now = time.monotonic()
    if _market_watch_cache and now - _market_watch_cache[0] < _MARKET_WATCH_CACHE_SECONDS:
        return MarketWatchResponse(**_market_watch_cache[1])

    async with _market_watch_lock:
        now = time.monotonic()
        if _market_watch_cache and now - _market_watch_cache[0] < _MARKET_WATCH_CACHE_SECONDS:
            return MarketWatchResponse(**_market_watch_cache[1])

        flow_id = new_flow_id()
        log_flow_event(flow_id, "MARKET WATCH", "Fetching one NSE NIFTY 500 snapshot via MCP")
        try:
            async with market_watch_toolset:
                response = await market_watch_toolset.call_tool_for_app(
                    "get_nse_market_watch", {}
                )
            data = read_mcp_result(response)
        except Exception as exc:
            log_flow_event(
                flow_id,
                "MARKET WATCH FAILED",
                f"{type(exc).__name__}: {str(exc)[:120]}",
            )
            raise StockDataUnavailableError(
                "NSE market-watch data is temporarily unavailable. Please try again."
            ) from exc

        result = MarketWatchResponse(
            index=data.get("index", "NIFTY 500"),
            retrieved_at=datetime.now(ZoneInfo("Asia/Kolkata")),
            rows=data.get("rows", []),
            source=data.get("source", "NSE via jugaad-data"),
        )
        _market_watch_cache = (time.monotonic(), result.model_dump())
        log_flow_event(flow_id, "MARKET WATCH READY", f"{len(result.rows)} stock quotes received")
        return result
