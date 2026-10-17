"""MCP tools for live and historical NSE equity data via jugaad-data."""

import asyncio
import math
import re
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastmcp import FastMCP
from jugaad_data.nse import NSELive, stock_df


stock_data_mcp = FastMCP(
    "MarketBrief India Stock Data",
    instructions=(
        "Fetch Indian NSE stock quotes and historical EQ-series prices. "
        "Symbols use NSE codes such as RELIANCE, SBIN, or TCS, without .NS."
    ),
)
_SYMBOL_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9.&-]{0,29}$")


def normalize_symbol(symbol: str) -> str:
    value = symbol.strip().upper()
    if value.endswith(".NS"):
        value = value[:-3]
    if not _SYMBOL_PATTERN.fullmatch(value):
        raise ValueError("Enter a valid NSE symbol, for example RELIANCE or SBIN.")
    return value


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = float(str(value).replace(",", "").replace("%", "").strip())
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _text(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _quote_payload(symbol: str, response: dict[str, Any]) -> dict[str, Any]:
    price = response.get("priceInfo") or {}
    info = response.get("info") or {}
    metadata = response.get("metadata") or {}
    intraday = price.get("intraDayHighLow") or {}
    week = price.get("weekHighLow") or {}

    return {
        "symbol": symbol,
        "company_name": info.get("companyName") or info.get("company_name"),
        "last_price": _number(price.get("lastPrice")),
        "change": _number(price.get("change")),
        "percent_change": _number(price.get("pChange")),
        "previous_close": _number(price.get("previousClose")),
        "open": _number(price.get("open")),
        "close": _number(price.get("close")),
        "vwap": _number(price.get("vwap")),
        "day_high": _number(intraday.get("max")),
        "day_low": _number(intraday.get("min")),
        "week_high": _number(week.get("max")),
        "week_low": _number(week.get("min")),
        "data_as_of": _text(
            metadata.get("lastUpdateTime")
            or metadata.get("lastPriceDate")
            or metadata.get("tradeDate")
        ),
        "source": "NSE via jugaad-data",
    }


def _fetch_quote(symbol: str) -> dict[str, Any]:
    return NSELive().stock_quote(symbol)


def _history_payload(symbol: str, days: int) -> dict[str, Any]:
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    start = today - timedelta(days=days)
    frame = stock_df(symbol=symbol, from_date=start, to_date=today, series="EQ")
    if frame is None or frame.empty:
        return {"symbol": symbol, "days": days, "points": [], "source": "NSE via jugaad-data"}

    points = []
    for row in frame.tail(30).to_dict(orient="records"):
        normalized = {str(key).lower().replace(" ", "").replace(".", ""): value for key, value in row.items()}
        raw_date = next(
            (normalized[key] for key in ("date", "tradedate") if key in normalized),
            None,
        )
        point_date = raw_date.isoformat() if hasattr(raw_date, "isoformat") else str(raw_date or "")
        points.append(
            {
                "date": point_date,
                "open": _number(normalized.get("open")),
                "high": _number(normalized.get("high")),
                "low": _number(normalized.get("low")),
                "close": _number(normalized.get("close")),
                "volume": _number(normalized.get("volume")),
            }
        )

    return {
        "symbol": symbol,
        "days": days,
        "points": points,
        "source": "NSE via jugaad-data",
    }


@stock_data_mcp.tool()
async def get_nse_stock_quote(symbol: str) -> dict[str, Any]:
    """Fetch the latest available NSE quote for a single Indian stock symbol."""
    normalized_symbol = normalize_symbol(symbol)
    try:
        result = await asyncio.to_thread(_fetch_quote, normalized_symbol)
        payload = _quote_payload(normalized_symbol, result)
    except Exception as exc:
        raise RuntimeError(f"NSE quote data is unavailable for {normalized_symbol}.") from exc
    if payload["last_price"] is None:
        raise RuntimeError(f"NSE did not return a usable quote for {normalized_symbol}.")
    return payload


@stock_data_mcp.tool()
async def get_nse_stock_history(symbol: str, days: int = 30) -> dict[str, Any]:
    """Fetch up to 30 recent NSE EQ-series daily OHLCV points for 1–365 days."""
    normalized_symbol = normalize_symbol(symbol)
    if not 1 <= days <= 365:
        raise ValueError("days must be between 1 and 365.")
    try:
        payload = await asyncio.to_thread(_history_payload, normalized_symbol, days)
    except Exception as exc:
        raise RuntimeError(f"NSE history is unavailable for {normalized_symbol}.") from exc
    return payload
