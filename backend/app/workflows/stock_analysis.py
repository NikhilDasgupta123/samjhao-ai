from functools import lru_cache
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.stock_agent import read_mcp_result, stock_toolset, summarize_stock
from app.core.flow_logger import log_flow_event, new_flow_id
from app.schemas.stock import StockAnalyzeRequest, StockAnalyzeResponse
from app.services.ai_service import AIServiceError


class StockAnalysisState(TypedDict, total=False):
    symbol: str
    question: str
    history_days: int
    flow_id: str
    quote: dict
    history: dict
    brief: object


class StockDataUnavailableError(Exception):
    """Raised when the NSE MCP server cannot provide the requested data."""


async def analyze_stock_node(state: StockAnalysisState) -> dict:
    symbol = state["symbol"]
    flow_id = state["flow_id"]
    try:
        log_flow_event(flow_id, "STOCK AGENT", "PydanticAI → Cloudflare Workers AI text model")
        async with stock_toolset:
            log_flow_event(flow_id, "MCP CONNECTION", "Local NSE stock-data server is ready")
            log_flow_event(flow_id, "MCP TOOL CALL", f"get_nse_stock_quote(symbol={symbol})")
            quote_response = await stock_toolset.call_tool_for_app(
                "get_nse_stock_quote", {"symbol": symbol}
            )
            quote = read_mcp_result(quote_response)
            log_flow_event(flow_id, "MCP TOOL RESULT", "Latest available NSE quote received")
            log_flow_event(
                flow_id,
                "MCP TOOL CALL",
                f"get_nse_stock_history(symbol={symbol}, days={state['history_days']})",
            )
            history_response = await stock_toolset.call_tool_for_app(
                "get_nse_stock_history",
                {"symbol": symbol, "days": state["history_days"]},
            )
            history = read_mcp_result(history_response)
            log_flow_event(
                flow_id,
                "MCP DATA READY",
                f"NSE quote received; {len(history.get('points', []))} history points",
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
        f"Endpoint: POST /api/stocks/analyze | Symbol: {request.symbol}",
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
