from functools import lru_cache
import json

from pydantic_ai import Agent, PromptedOutput
from pydantic_ai.mcp import MCPToolset

from app.agents.model import get_stock_model
from app.mcp_servers.stock_data import stock_data_mcp
from app.prompts.stock_analysis import STOCK_ANALYSIS_PROMPT
from app.schemas.stock import StockResearchBrief
from app.services.ai_service import AIServiceError


stock_toolset = MCPToolset(stock_data_mcp)


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


def read_mcp_result(response: dict) -> dict:
    """Decode structured MCP output and turn protocol errors into useful messages."""
    if response.get("isError"):
        messages = [
            item.get("text", "")
            for item in response.get("content", [])
            if isinstance(item, dict) and item.get("text")
        ]
        detail = "; ".join(messages) or "MCP stock data tool failed."
        raise RuntimeError(detail)

    structured = response.get("structuredContent")
    if isinstance(structured, dict):
        return structured

    for item in response.get("content", []):
        text = item.get("text") if isinstance(item, dict) else None
        if text:
            try:
                value = json.loads(text)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                return value
    raise RuntimeError("The stock MCP tool returned an unreadable response.")


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
