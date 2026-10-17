from pydantic import BaseModel, Field, field_validator

from app.mcp_servers.stock_data import normalize_symbol


class StockAnalyzeRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=33, description="NSE stock symbol")
    question: str = Field(
        default="Give me a concise overview of the latest quote and recent price trend.",
        min_length=1,
        max_length=500,
    )
    history_days: int = Field(default=30, ge=1, le=365)

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, value: str) -> str:
        return normalize_symbol(value)

    @field_validator("question")
    @classmethod
    def trim_question(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter a question for the Stock Agent.")
        return value


class StockResearchBrief(BaseModel):
    summary: str = Field(description="Plain-language, data-grounded stock overview")
    key_observations: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)


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


class StockAnalyzeResponse(BaseModel):
    status: str = "success"
    symbol: str
    question: str
    quote: StockQuote
    history: list[StockHistoryPoint] = Field(default_factory=list)
    brief: StockResearchBrief
    disclaimer: str = "Informational research only; this is not investment advice."
