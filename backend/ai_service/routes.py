from fastapi import APIRouter

from app.ai.schemas import StockAnalyzeRequest, StockAnalyzeResponse
from app.ai.workflows.stock_analysis import analyze_stock


router = APIRouter(prefix="/internal/stocks", tags=["Internal AI"])


@router.post("/analyze", response_model=StockAnalyzeResponse)
async def run_stock_analysis(request: StockAnalyzeRequest):
    """Run the LangGraph and Stock Agent workflow inside the AI service."""
    return await analyze_stock(request)
