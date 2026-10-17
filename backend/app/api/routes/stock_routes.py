from fastapi import APIRouter

from auth.dependencies import CurrentUser
from app.ai.catalyst_schemas import StockCatalystRequest, StockCatalystResponse
from app.ai.client import (
    analyze_stock_with_ai_service,
    research_stock_catalysts_with_ai_service,
)
from app.ai.schemas import StockAnalyzeRequest, StockAnalyzeResponse
from app.stocks.schemas import (
    MarketWatchResponse,
    StockMarketDataRequest,
    StockMarketDataResponse,
)
from app.stocks.data.market_data_service import get_nse_market_watch, get_stock_market_data


router = APIRouter(prefix="/api/stocks", tags=["Stock market"])


@router.post("/analyze", response_model=StockAnalyzeResponse)
async def analyze_stock_request(request: StockAnalyzeRequest, _user: CurrentUser):
    """Forward authenticated stock analysis to the separate AI service."""
    return await analyze_stock_with_ai_service(request)


@router.post("/catalysts", response_model=StockCatalystResponse)
async def stock_catalysts_request(request: StockCatalystRequest, _user: CurrentUser):
    """Search recent stock-related article and video sources through the AI service."""
    return await research_stock_catalysts_with_ai_service(request)


@router.post("/market-data", response_model=StockMarketDataResponse)
async def stock_market_data_request(request: StockMarketDataRequest, _user: CurrentUser):
    """Return the latest NSE quote and daily history without an AI-generated brief."""
    return await get_stock_market_data(request)


@router.get("/market-watch", response_model=MarketWatchResponse)
async def nse_market_watch(_user: CurrentUser):
    """Return the latest available NIFTY 500 snapshot for the market-watch table."""
    return await get_nse_market_watch()
