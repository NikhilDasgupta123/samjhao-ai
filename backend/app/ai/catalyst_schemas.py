from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator

from app.stocks.symbols import normalize_symbol


class StockCatalystRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=33, description="NSE stock symbol")
    company_name: str | None = Field(default=None, max_length=200)
    refresh: bool = False

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, value: str) -> str:
        return normalize_symbol(value)

    @field_validator("company_name")
    @classmethod
    def clean_company_name(cls, value: str | None) -> str | None:
        value = (value or "").strip()
        return value[:200] or None


class CatalystSource(BaseModel):
    id: str
    kind: Literal["news", "web", "video"]
    title: str
    url: AnyHttpUrl
    publisher: str | None = None
    published_at: str | None = None
    snippet: str | None = None
    thumbnail_url: AnyHttpUrl | None = None


class CatalystFactor(BaseModel):
    topic: str
    direction: Literal["positive", "negative", "mixed", "unclear"] = "unclear"
    explanation: str
    source_ids: list[str] = Field(default_factory=list)


class CatalystBrief(BaseModel):
    summary: str
    factors: list[CatalystFactor] = Field(default_factory=list)
    limitation: str = (
        "These are reported topics, not confirmed causes of a price move. "
        "Review the linked sources before drawing conclusions."
    )


class StockCatalystResponse(BaseModel):
    status: str = "success"
    symbol: str
    company_name: str | None = None
    retrieved_at: str
    news: list[CatalystSource] = Field(default_factory=list)
    web: list[CatalystSource] = Field(default_factory=list)
    videos: list[CatalystSource] = Field(default_factory=list)
    brief: CatalystBrief
    news_error: str | None = None
    web_error: str | None = None
    video_error: str | None = None
    summary_error: str | None = None
    cached: bool = False
