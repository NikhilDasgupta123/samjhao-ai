from functools import lru_cache
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.ai.agents.stock_agent import summarize_stock
from app.core.flow_logger import log_flow_event, new_flow_id
from app.stocks.data.market_data_service import (
    fetch_stock_market_data,
    stock_toolset,
)
from app.ai.errors import AIServiceError
from app.ai.schemas import StockAnalyzeRequest, StockAnalyzeResponse
from app.stocks.errors import StockDataUnavailableError


class StockAnalysisState(TypedDict, total=False):
    symbol: str
    question: str
    history_days: int
    flow_id: str
    quote: dict
    history: dict
    brief: object


async def analyze_stock_node(state: StockAnalysisState) -> dict:
    symbol = state["symbol"]
    flow_id = state["flow_id"]
    try:
        async with stock_toolset:
            log_flow_event(flow_id, "STOCK AGENT", "PydanticAI → Cloudflare Workers AI text model")
            quote, history = await fetch_stock_market_data(
                symbol,
                state["history_days"],
                flow_id,
                reuse_open_session=True,
            )
            brief = await summarize_stock(
                symbol=symbol,
                question=state["question"],
                quote=quote,
                history=history,
            )
    except AIServiceError as exc:
        log_flow_event(flow_id, "STOCK AGENT FAILED", type(exc).__name__)
        raise
    except StockDataUnavailableError:
        raise
    except Exception as exc:
        log_flow_event(
            flow_id,
            "MCP WORKFLOW FAILED",
            f"{type(exc).__name__}: {str(exc)[:160]}",
        )
        raise StockDataUnavailableError(
            f"Could not fetch NSE data for {symbol}. Confirm the NSE symbol and try again."
        ) from exc

    log_flow_event(flow_id, "STOCK AGENT", "Research brief returned")
    return {"quote": quote, "history": history, "brief": brief}


@lru_cache(maxsize=1)
def get_stock_analysis_graph():
    workflow = StateGraph(StockAnalysisState)
    workflow.add_node("stock_agent", analyze_stock_node)

    def route_to_stock_agent(state: StockAnalysisState) -> str:
        log_flow_event(
            state["flow_id"],
            "LANGGRAPH ROUTING",
            f"NSE:{state['symbol']} → Stock Agent → NSE MCP data tools",
        )
        return "stock_agent"

    workflow.add_conditional_edges(START, route_to_stock_agent, {"stock_agent": "stock_agent"})
    workflow.add_edge("stock_agent", END)
    return workflow.compile()


async def analyze_stock(request: StockAnalyzeRequest) -> StockAnalyzeResponse:
    flow_id = new_flow_id()
    log_flow_event(
        flow_id,
        "REQUEST RECEIVED",
        f"Endpoint: POST /internal/stocks/analyze | Symbol: {request.symbol}",
    )
    result = await get_stock_analysis_graph().ainvoke(
        {
            "symbol": request.symbol,
            "question": request.question,
            "history_days": request.history_days,
            "flow_id": flow_id,
        }
    )

    response = StockAnalyzeResponse(
        symbol=request.symbol,
        question=request.question,
        quote=result["quote"],
        history=result["history"].get("points", []),
        brief=result["brief"],
    )
    log_flow_event(flow_id, "API RESPONSE", "Stock brief and NSE data are ready")
    return response
