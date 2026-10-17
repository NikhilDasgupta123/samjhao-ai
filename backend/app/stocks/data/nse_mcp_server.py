"""MCP tools for live and historical NSE equity data via jugaad-data."""

import asyncio
import math
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastmcp import FastMCP
from jugaad_data.nse import NSELive, stock_df

from app.stocks.symbols import normalize_symbol


stock_data_mcp = FastMCP(
    "MarketBrief India Stock Data",
    instructions=(
        "Fetch Indian NSE stock quotes and historical EQ-series prices. "
        "Symbols use NSE codes such as RELIANCE, SBIN, or TCS, without .NS."
    ),
)
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


def _india_market_date(value: Any) -> str:
    """Normalize NSE daily dates without shifting them across timezone boundaries."""
    market_timezone = ZoneInfo("Asia/Kolkata")
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        return value.isoformat()
    else:
        raw = str(value or "").strip()
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            for date_format in ("%d-%b-%Y", "%d-%m-%Y", "%Y/%m/%d"):
                try:
                    return datetime.strptime(raw, date_format).date().isoformat()
                except ValueError:
                    continue
            try:
                return date.fromisoformat(raw[:10]).isoformat()
            except ValueError:
                return raw

    if parsed.tzinfo is not None:
        return parsed.astimezone(market_timezone).date().isoformat()
    if parsed.time() != datetime.min.time():
        # jugaad-data can expose an India-midnight daily date as a naive UTC value.
        return parsed.replace(tzinfo=timezone.utc).astimezone(market_timezone).date().isoformat()
    return parsed.date().isoformat()


def _quote_payload(symbol: str, response: dict[str, Any]) -> dict[str, Any]:
    price = response.get("priceInfo") or {}
    info = response.get("metaData") or response.get("info") or {}
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
            response.get("lastUpdateTime")
            or metadata.get("lastUpdateTime")
            or metadata.get("lastPriceDate")
            or metadata.get("tradeDate")
        ),
        "source": "NSE via jugaad-data",
    }


def _fetch_quote(symbol: str) -> dict[str, Any]:
    return NSELive().stock_quote(symbol)


def _market_watch_payload() -> dict[str, Any]:
    response = NSELive().live_index("NIFTY 500")
    if not isinstance(response, dict) or not isinstance(response.get("data"), list):
        raise RuntimeError("NSE did not return NIFTY 500 market-watch data.")

    rows = []
    for item in response["data"]:
        symbol = str(item.get("symbol") or "").strip().upper()
        last_price = _number(item.get("lastPrice"))
        if not symbol or symbol == "NIFTY 500" or last_price is None:
            continue
        rows.append(
            {
                "symbol": symbol,
                "company_name": item.get("companyName")
                or (item.get("metaData") or {}).get("companyName"),
                "last_price": last_price,
                "change": _number(item.get("change")),
                "percent_change": _number(item.get("pChange")),
                "previous_close": _number(item.get("previousClose")),
                "volume": _number(item.get("totalTradedVolume")),
                "updated_at": item.get("lastUpdateTime") or response.get("timestamp"),
            }
        )

    if not rows:
        raise RuntimeError("NSE returned no stock quotes for NIFTY 500.")
    return {
        "index": "NIFTY 500",
        "updated_at": response.get("timestamp"),
        "rows": rows,
        "source": "NSE via jugaad-data",
    }


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
        point_date = _india_market_date(raw_date) if raw_date is not None else ""
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
        response_keys = ", ".join(sorted(result)) if isinstance(result, dict) else type(result).__name__
        price_keys = ", ".join(sorted((result.get("priceInfo") or {}))) if isinstance(result, dict) else "unavailable"
        raise RuntimeError(
            f"NSE quote for {normalized_symbol} did not include priceInfo.lastPrice "
            f"(response keys: {response_keys or 'none'}; priceInfo keys: {price_keys or 'none'})."
        )
    return payload


@stock_data_mcp.tool()
async def get_nse_market_watch() -> dict[str, Any]:
    """Fetch the latest NSE index snapshot for all available NIFTY 500 constituents."""
    try:
        return await asyncio.to_thread(_market_watch_payload)
    except Exception as exc:
        raise RuntimeError("NSE market-watch data is currently unavailable.") from exc


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
