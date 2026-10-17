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
    videos: list[CatalystSource],
) -> CatalystBrief:
    sources = [source.model_dump(mode="json") for source in [*news, *videos]]
    prompt = (
        f"NSE symbol: {symbol}\nCompany: {company_name or 'unknown'}\n\n"
        "Available source metadata (JSON):\n"
        f"{json.dumps(sources, ensure_ascii=False, allow_nan=False)}"
    )
    result = await get_catalyst_agent().run(prompt)

    valid_ids = {source.id for source in [*news, *videos]}
    factors = [
        factor.model_copy(update={"source_ids": [item for item in factor.source_ids if item in valid_ids]})
        for factor in result.output.factors
    ]
    factors = [factor for factor in factors if factor.source_ids]
    return result.output.model_copy(update={"factors": factors})
