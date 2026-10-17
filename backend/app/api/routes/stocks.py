from fastapi import APIRouter

from auth.dependencies import CurrentUser
from app.schemas.stock import StockAnalyzeRequest, StockAnalyzeResponse
from app.workflows.stock_analysis import analyze_stock


router = APIRouter(prefix="/api/stocks", tags=["Stock research"])


@router.post("/analyze", response_model=StockAnalyzeResponse)
async def analyze_stock_request(request: StockAnalyzeRequest, _user: CurrentUser):
    """Analyze an NSE-listed stock with live/history data from the local MCP server."""
    return await analyze_stock(request)
