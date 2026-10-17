from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.stocks.symbols import normalize_symbol


class StockMarketDataRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=33, description="NSE stock symbol")
    history_days: int = Field(default=30, ge=1, le=365)

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, value: str) -> str:
        return normalize_symbol(value)


class StockQuote(BaseModel):
    symbol: str
    company_name: str | None = None
    last_price: float | None = None
    change: float | None = None
    percent_change: float | None = None
    previous_close: float | None = None
    open: float | None = None
    close: float | None = None
    vwap: float | None = None
    day_high: float | None = None
    day_low: float | None = None
    week_high: float | None = None
    week_low: float | None = None
    data_as_of: str | None = None
    source: str = "NSE via jugaad-data"


class StockHistoryPoint(BaseModel):
    date: str
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None
    volume: float | None = None


class StockMarketDataResponse(BaseModel):
    status: str = "success"
    symbol: str
    retrieved_at: datetime
    quote: StockQuote
    history: list[StockHistoryPoint] = Field(default_factory=list)


class MarketWatchStock(BaseModel):
    symbol: str
    company_name: str | None = None
    last_price: float
    change: float | None = None
    percent_change: float | None = None
    previous_close: float | None = None
    volume: float | None = None
    updated_at: str | None = None


class MarketWatchResponse(BaseModel):
    status: str = "success"
    index: str = "NIFTY 500"
    retrieved_at: datetime
    rows: list[MarketWatchStock] = Field(default_factory=list)
    source: str = "NSE via jugaad-data"
    refresh_interval_seconds: int = 1
