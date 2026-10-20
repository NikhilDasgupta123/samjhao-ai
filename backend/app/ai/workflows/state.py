"""Shared LangGraph state for the stock research workflows."""

from typing import Any, Literal, TypedDict

from app.ai.catalyst_schemas import CatalystBrief, CatalystSource
from app.ai.schemas import StockResearchBrief


WorkflowTask = Literal["stock_analysis", "catalysts"]


class WorkflowState(TypedDict, total=False):
    """Values passed between nodes in the unified stock research graph."""

    task: WorkflowTask
    symbol: str
    flow_id: str

    # Stock analysis branch
    question: str
    history_days: int
    quote: dict[str, Any]
    history: dict[str, Any]
    stock_brief: StockResearchBrief

    # Catalyst research branch
    company_name: str | None
    news: list[CatalystSource]
    web: list[CatalystSource]
    videos: list[CatalystSource]
    news_error: str | None
    web_error: str | None
    video_error: str | None
    catalyst_brief: CatalystBrief
    summary_error: str | None
