import json
from functools import lru_cache

from pydantic_ai import Agent

from app.ai.catalyst_schemas import CatalystBrief, CatalystSource
from app.ai.models.cloudflare import get_stock_model
from app.ai.prompts.catalyst_research import CATALYST_RESEARCH_PROMPT


@lru_cache(maxsize=1)
def get_catalyst_agent() -> Agent[None, CatalystBrief]:
    return Agent(
        get_stock_model(),
        name="Market Catalyst Agent",
        output_type=CatalystBrief,
        system_prompt=CATALYST_RESEARCH_PROMPT,
    )


async def summarize_stock_catalysts(
    *,
    symbol: str,
    company_name: str | None,
    news: list[CatalystSource],
    web: list[CatalystSource],
    videos: list[CatalystSource],
) -> CatalystBrief:
    sources = [source.model_dump(mode="json") for source in [*news, *web, *videos]]
    prompt = (
        "Research scope: one NSE-listed stock.\n"
        f"NSE symbol: {symbol}\nCompany: {company_name or 'unknown'}\n\n"
        "Available source metadata (JSON):\n"
        f"{json.dumps(sources, ensure_ascii=False, allow_nan=False)}"
    )
    result = await get_catalyst_agent().run(prompt)
    return _filter_brief_sources(result.output, [*news, *web, *videos])


async def summarize_daily_market_catalysts(
    *,
    as_of_date: str,
    news: list[CatalystSource],
    web: list[CatalystSource],
    videos: list[CatalystSource],
) -> CatalystBrief:
    """Use the Market Catalyst Agent for the daily India-wide stock digest."""
    all_sources = [*news, *web, *videos]
    sources = [source.model_dump(mode="json") for source in all_sources]
    prompt = (
        "Research scope: India-wide daily NSE equities market digest.\n"
        f"Digest date in India Standard Time: {as_of_date}\n\n"
        "Available source metadata (JSON):\n"
        f"{json.dumps(sources, ensure_ascii=False, allow_nan=False)}"
    )
    result = await get_catalyst_agent().run(prompt)
    return _filter_brief_sources(result.output, all_sources)


def _filter_brief_sources(brief: CatalystBrief, sources: list[CatalystSource]) -> CatalystBrief:
    valid_ids = {source.id for source in sources}
    factors = [
        factor.model_copy(update={"source_ids": [source_id for source_id in factor.source_ids if source_id in valid_ids]})
        for factor in brief.factors
    ]
    factors = [factor for factor in factors if factor.source_ids]
    return brief.model_copy(update={"factors": factors})
