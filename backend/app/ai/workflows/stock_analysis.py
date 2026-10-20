"""Stock analysis entry point for the shared LangGraph workflow."""

from app.ai.schemas import StockAnalyzeRequest, StockAnalyzeResponse
from app.ai.workflows.graph import get_workflow_graph
from app.core.flow_logger import log_flow_event, new_flow_id


async def analyze_stock(request: StockAnalyzeRequest) -> StockAnalyzeResponse:
    flow_id = new_flow_id()
    log_flow_event(
        flow_id,
        "REQUEST RECEIVED",
        f"Endpoint: POST /internal/stocks/analyze | Symbol: {request.symbol}",
    )
    result = await get_workflow_graph().ainvoke(
        {
            "task": "stock_analysis",
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
        brief=result["stock_brief"],
    )
    log_flow_event(flow_id, "API RESPONSE", "Stock brief and NSE data are ready")
    return response
