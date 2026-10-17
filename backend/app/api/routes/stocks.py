from fastapi import APIRouter

from auth.dependencies import CurrentUser
from app.schemas.stock import (
    MarketWatchResponse,
    StockAnalyzeRequest,
    StockAnalyzeResponse,
    StockMarketDataRequest,
    StockMarketDataResponse,
)
from app.services.stock_market_service import get_nse_market_watch, get_stock_market_data
from app.workflows.stock_analysis import analyze_stock


router = APIRouter(prefix="/api/stocks", tags=["Stock market"])


@router.post("/analyze", response_model=StockAnalyzeResponse)
async def analyze_stock_request(request: StockAnalyzeRequest, _user: CurrentUser):
    """Analyze an NSE-listed stock with live/history data from the local MCP server."""
    return await analyze_stock(request)


@router.post("/market-data", response_model=StockMarketDataResponse)
async def stock_market_data_request(request: StockMarketDataRequest, _user: CurrentUser):
    """Return the latest NSE quote and daily history without an AI-generated brief."""
    return await get_stock_market_data(request)


@router.get("/market-watch", response_model=MarketWatchResponse)
async def nse_market_watch(_user: CurrentUser):
    """Return the latest available NIFTY 500 snapshot for the market-watch table."""
    return await get_nse_market_watch()
