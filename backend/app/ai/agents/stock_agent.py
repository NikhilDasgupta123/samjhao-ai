'''Answers questions about NSE stocks using verified market data and research tools.'''

from functools import lru_cache
import json

from pydantic_ai import Agent, PromptedOutput

from app.ai.models.cloudflare import get_stock_model
from app.ai.prompts.stock_analysis import STOCK_ANALYSIS_PROMPT
from app.ai.errors import AIServiceError
from app.ai.schemas import StockResearchBrief
from app.stocks.data.market_data_service import stock_toolset


@lru_cache(maxsize=1)
def get_stock_agent() -> Agent[None, StockResearchBrief]:
    """Build the single research agent and give it the local NSE MCP toolset."""
    return Agent(
        get_stock_model(),
        name="Stock Agent",
        output_type=PromptedOutput(StockResearchBrief),
        system_prompt=STOCK_ANALYSIS_PROMPT,
        toolsets=[stock_toolset],
    )


async def summarize_stock(
    *,
    symbol: str,
    question: str,
    quote: dict,
    history: dict,
) -> StockResearchBrief:
    prompt = (
        f"Requested NSE symbol: {symbol}\n"
        f"User question: {question}\n\n"
        "Verified quote data from the NSE MCP tool (JSON):\n"
        f"{json.dumps(quote, ensure_ascii=False, allow_nan=False)}\n\n"
        "Verified recent daily history from the NSE MCP tool (JSON):\n"
        f"{json.dumps(history, ensure_ascii=False, allow_nan=False)}\n\n"
        "Summarize only what these data support. You may use the attached MCP tools "
        "if additional NSE data is needed."
    )
    try:
        result = await get_stock_agent().run(prompt)
    except Exception as exc:
        raise AIServiceError(
            "Cloudflare Workers AI stock analysis failed. Check the Cloudflare "
            "credentials and configured text model."
        ) from exc
    return result.output
