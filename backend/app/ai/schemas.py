from pydantic import BaseModel, Field, field_validator

from app.stocks.schemas import StockHistoryPoint, StockQuote
from app.stocks.symbols import normalize_symbol


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


class StockAnalyzeResponse(BaseModel):
    status: str = "success"
    symbol: str
    question: str
    quote: StockQuote
    history: list[StockHistoryPoint] = Field(default_factory=list)
    brief: StockResearchBrief
    disclaimer: str = "Informational research only; this is not investment advice."
